# Bitácora compacta — POS Comic Shop

Registra cada ronda en **3–5 líneas**, con fecha, cambios, pruebas, bloqueos y siguiente paso. Este archivo no sustituye el código, los logs ni los PR. Máximo 200 líneas; consolidar entradas antiguas cuando corresponda.

## 2026-11-25 — Estado candidato v2.43
- La v2.42 sigue publicada; desarrollo de v2.43 concentrado en PR #21, sin fusionar.
- Se integraron mejoras en cobros, inventario transaccional, caja personal e idempotencia.
- CI #45657887101 aprobó emulador Firestore, navegador PWA y piloto.
- Persisten limitaciones históricas de borradores en clientes v2.35.

## 2026-11-25 — Firebase y pruebas remotas
- GitHub–Google Cloud WIF verificado; no equivale a backend v2.43 desplegado.
- Usuario aprobó probar con Firebase existente `punto-de-venta-comic-shop` y su admin habitual.
- Script remoto incorpora precheck sin escrituras, controles de proyecto e identificador de ejecución.
- Pendiente: acceso Auth real, auditoría de reglas/Function desplegadas y ejecución de cestas remotas.

## 2026-11-25 — Alcance pospuesto
- El propietario quiere reinicio total del POS antes de empezar operación comercial: issue #26.
- Se pospone hasta terminar las validaciones; no hay autorización para borrar ahora.
- Lotes mayoristas por goteo, vencimientos/«cliente fantasma» y tasa paralela requieren especificación.
- No tocar el proyecto externo Pedidos Personalizados.

## 2026-11-25 — Sistema de memoria
- Se incorpora `.agents/skills/pos-contexto/SKILL.md` para lectura y actualización guiada.
- `AGENTS.md` conserva reglas permanentes; `ESTADO_ACTUAL.md` resume el próximo paso.
- En cada ronda con cambios Codex actualizará ESTADO_ACTUAL y añadirá 3–5 líneas a BITACORA.
- No atribuir pruebas remotas realizadas a ejecuciones locales del emulador.
