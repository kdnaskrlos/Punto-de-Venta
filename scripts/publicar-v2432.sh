#!/usr/bin/env bash
# Publicación y reversión del árbol estático en el mismo origen de GitHub Pages.
set -euo pipefail
repo=kdnaskrlos/Punto-de-Venta
rama=release/pos-v2.42-candidata
base=0c3c7983fb288acc475ff4b44bcf071ea40df0f2
url=https://kdnaskrlos.github.io/Punto-de-Venta
accion=${1:-}
sha=${2:-}
fallar() { printf '%s\n' "$*" >&2; exit 1; }
[[ ($accion == publicar && $sha =~ ^[0-9a-f]{40}$) || ($accion == revertir && -z $sha) ]] ||
  fallar 'Uso: publicar-v2432.sh publicar SHA | publicar-v2432.sh revertir'

fuente=$(gh api "repos/$repo/pages" --jq '[.build_type,.source.branch,.source.path] | join(" ")')
[[ $fuente == "legacy $rama /" ]] ||
  fallar "Pages usa una fuente distinta de la rama estática revisada: $fuente"

tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
git clone -q "https://github.com/$repo.git" "$tmp/fuente"
git -C "$tmp/fuente" worktree add -q --detach "$tmp/sitio" "origin/$rama"
cd "$tmp/sitio"
git merge-base --is-ancestor "$base" HEAD ||
  fallar 'La publicación estática no desciende de la v2.42 verificada.'
mkdir "$tmp/base"
git archive "$base" | tar -x -C "$tmp/base"

coincide_publico() {
  curl -fsS --max-time 15 "$url/$1?pos-revision=$(date +%s%N)" -o "$tmp/http" &&
    cmp -s "$tmp/http" "$1"
}

esperar_publicacion() {
  for (( intento=0; intento<40; intento++ )); do
    if coincide_publico "$1"; then return; fi
    sleep 10
  done
  fallar "Pages todavía no sirve los bytes de $1. Revisa el despliegue en GitHub."
}

subir() {
  git add -A
  if ! git diff --cached --quiet; then git commit -m "$1"; fi
  git push origin "HEAD:refs/heads/$rama"
}

verificar_publicado() {
  esperar_publicacion sw.js
  esperar_publicacion index.html
  esperar_publicacion config.js
  esperar_publicacion "$1/js/version.js"
}

for archivo in index.html sw.js config.js; do
  coincide_publico "$archivo" || fallar "El archivo público $archivo no coincide con la rama de Pages."
done

if [[ $accion == revertir ]]; then
  grep -Fq 'pos-v2.43.2-' sw.js || fallar 'La revisión pública que se va a revertir no es v2.43.2.'
  read -r -p 'Con las colas conciliadas, escribe REVERTIR v2.42 para autorizar: ' permiso
  [[ $permiso == 'REVERTIR v2.42' ]] || fallar 'Reversión cancelada.'
  cp "$tmp/base/"{index.html,sw.js,config.js} .
  subir 'Restaura entradas públicas de POS v2.42 y conserva ambos grafos'
  verificar_publicado versiones/v2.42-57bc1ad5b01c5d41
  exit
fi

for archivo in index.html sw.js config.js; do
  cmp -s "$tmp/base/$archivo" "$archivo" || fallar "La versión pública actual no coincide con v2.42 ($archivo)."
done
cd "$tmp/fuente"
estado=$(gh pr view 21 --repo "$repo" --json baseRefName,headRefName,headRefOid,state --jq \
  '[.baseRefName,.headRefName,.headRefOid,.state] | join(" ")')
case "$estado" in
  "main integracion/pos-auditoria $sha OPEN"|"main integracion/pos-auditoria $sha MERGED") ;;
  *) fallar "El PR #21 no coincide con el SHA autorizado: $estado" ;;
esac

read -r -p 'Con respaldo vigente y colas conciliadas, escribe PUBLICAR v2.43.2 para autorizar: ' permiso
[[ $permiso == 'PUBLICAR v2.43.2' ]] || fallar 'Publicación cancelada.'
if [[ $estado == *' OPEN' ]]; then
  if [[ $(gh pr view 21 --repo "$repo" --json isDraft --jq '.isDraft') == true ]]; then
    gh pr ready 21 --repo "$repo"
  fi
  gh pr checks 21 --repo "$repo" --watch
  gh pr merge 21 --repo "$repo" --merge --match-head-commit "$sha"
fi

git fetch origin main
git merge-base --is-ancestor "$sha" origin/main ||
  fallar 'El SHA aprobado aún no está integrado en main.'
git diff --quiet "$sha" origin/main -- index.html sw.js config.js js css manifest.webmanifest ||
  fallar 'El código de la PWA en main difiere de la revisión autorizada.'
git switch -q --detach origin/main
node --input-type=module -e 'import {firebaseConfig as c} from "./config.js"; if(c.projectId!=="punto-de-venta-comic-shop" || c.ventasAtomicas!==true) process.exit(1)'
[[ $(node pruebas/pwa/huella.cjs) == "$(sed -n "s/^const HUELLA_APP = '\([^']*\)';/\1/p" sw.js)" ]] ||
  fallar 'La huella de la PWA no coincide con su código.'
node scripts/preparar-publicacion.cjs "$tmp/candidata" "$tmp/sitio" > "$tmp/publicacion.json"
prefijo=$(node -p 'require(process.argv[1]).prefijo' "$tmp/publicacion.json")
[[ $prefijo == versiones/v2.43.2-*/ ]] || fallar 'La versión preparada no es v2.43.2.'

cd "$tmp/sitio"
cp -a "$tmp/candidata/versiones/." versiones/
subir 'Precarga los recursos versionados de POS v2.43.2'
esperar_publicacion "${prefijo}js/version.js"
while IFS= read -r archivo; do
  coincide_publico "$archivo" || fallar "El recurso versionado $archivo todavía no coincide en Pages."
done < <(find "$prefijo" -type f | sort)
coincide_publico index.html && coincide_publico sw.js ||
  fallar 'Las entradas públicas cambiaron durante la precarga.'

cp -a "$tmp/candidata/." .
subir 'Publica POS v2.43.2 en GitHub Pages'
verificar_publicado "${prefijo%/}"
cat "$tmp/publicacion.json"
