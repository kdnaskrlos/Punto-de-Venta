#!/usr/bin/env bash
set +x
set -euo pipefail
umask 077
tmp=$(mktemp -d)
trap 'rm -rf -- "$tmp"' EXIT
sha=fa521e96c86e4052934ec9dcd080aceba06e7443
repo=${1:?Indica la copia local del repositorio Punto-de-Venta.}
shift
git -C "$repo" archive --format=zip --output="$tmp/funcion.zip" "$sha:funciones"

python3 - "$tmp/funcion.zip" "$sha" "$@" <<'PY'
import hashlib, json, re, subprocess, sys, time, zipfile
from pathlib import Path
from urllib.error import HTTPError, URLError
from urllib.parse import quote, urlencode, urlsplit
from urllib.request import Request, urlopen

project = "punto-de-venta-comic-shop"
p = f"projects/{project}"
parent = f"{p}/locations/us-central1"
name = "procesarVentaPos"
fn = f"{parent}/functions/{name}"
db = f"{p}/databases/(default)"
release = f"{p}/releases/cloud.firestore"
event = "google.cloud.firestore.document.v1.created"
pattern = "usuarios/{uid}/solicitudesVenta/{id}"
archive, sha, *identities = sys.argv[1:]
account = subprocess.check_output(
    ["gcloud", "auth", "list", "--filter=status:ACTIVE", "--format=value(account)"], text=True
).strip()
if not account or "\n" in account:
    sys.exit("BLOQUEADO: se requiere una cuenta activa de Google Cloud.")

def require(ok, reason):
    if not ok:
        sys.exit("BLOQUEADO: " + reason)

def token():
    return subprocess.check_output(
        ["gcloud", "auth", "print-access-token", "--account", account], text=True
    ).strip()

impersonation = subprocess.check_output(
    ["gcloud", "config", "get-value", "auth/impersonate_service_account", "--quiet"], text=True
).strip()
require(impersonation in {"", "(unset)"},
        "usa una sesión sin impersonación configurada para conservar la identidad del despliegue.")
access_token = token()
class ApiError(Exception):
    pass

def api(host, path, body=None, absent=False):
    headers = {"Authorization": "Bearer " + access_token, "Content-Type": "application/json"}
    req = Request(f"https://{host}.googleapis.com/{path}",
                  data=None if body is None else json.dumps(body).encode(), headers=headers)
    try:
        with urlopen(req, timeout=45) as response:
            return json.load(response)
    except HTTPError as error:
        if absent and error.code == 404:
            return None
        try:
            detail = json.loads(error.read() or b"{}").get("error", {}).get("message", "")
        except ValueError:
            detail = ""
        raise ApiError(f"{host}/{path} HTTP {error.code}. {detail}")
    except (URLError, TimeoutError):
        raise ApiError(f"sin respuesta de {host}/{path}.")

def report_error(kind, error, traceback):
    if isinstance(error, ApiError):
        sys.stderr.write(f"BLOQUEADO: {error}\n")
    else:
        sys.__excepthook__(kind, error, traceback)

sys.excepthook = report_error

def missing_permissions(host, path, permissions):
    result = api(host, path, {"permissions": list(permissions)})
    return sorted(set(permissions) - set(result.get("permissions", [])))

def project_permissions(permissions):
    return missing_permissions("cloudresourcemanager", f"v3/{p}:testIamPermissions", permissions)

def project_policy():
    return api("cloudresourcemanager", f"v3/{p}:getIamPolicy",
               {"options": {"requestedPolicyVersion": 3}})

def has_binding(policy, role, member):
    return any(b.get("role") == role and member in b.get("members", []) and not b.get("condition")
               for b in policy.get("bindings", []))

def gcloud(*args, capture=False):
    try:
        result = subprocess.run(
            ["gcloud", *args, "--project=" + project, "--account=" + account, "--quiet"],
            check=True, text=True, capture_output=capture)
        return (result.stdout or "") + "\n" + (result.stderr or "")
    except subprocess.CalledProcessError as error:
        detail = (error.stderr or "").strip()
        raise ApiError(f"gcloud {' '.join(args[:3])} terminó con código {error.returncode}. {detail}") from None

def project_binding(role, member):
    if not has_binding(project_policy(), role, member):
        gcloud("projects", "add-iam-policy-binding", project, "--role=" + role,
               "--member=" + member, "--condition=None")
    require(has_binding(project_policy(), role, member), f"no se comprobó la concesión {role} para {member}.")

def direct_permission(policy, member, permission):
    for binding in policy.get("bindings", []):
        if member not in binding.get("members", []) or binding.get("condition"):
            continue
        try:
            role = api("iam", "v1/" + binding["role"])
        except ApiError:
            continue
        if permission in role.get("includedPermissions", []):
            return True
    return False

def allow_evidence(resource, member, permission, policy):
    if direct_permission(policy, member, permission):
        return True
    query = urlencode({
        "analysisQuery.resourceSelector.fullResourceName": resource,
        "analysisQuery.identitySelector.identity": member,
        "analysisQuery.accessSelector.permissions": permission,
        "executionTimeout": "5s"
    })
    try:
        result = api("cloudasset", f"v1/{p}:analyzeIamPolicy?" + query)
    except ApiError:
        return None
    analysis = result.get("mainAnalysis", {})
    if not result.get("fullyExplored") or analysis.get("nonCriticalErrors"):
        return None
    matches = analysis.get("analysisResults", [])
    if any(not match.get("iamBinding", {}).get("condition") for match in matches):
        return True
    return False if not matches and project_root else None

def firestore_state():
    state = api("firestore", f"v1/{db}/documents/sistema/estado"
                "?mask.fieldPaths=soloVentasProcesadas", absent=True) or {}
    flag = state.get("fields", {}).get("soloVentasProcesadas")
    require(flag is None or flag == {"booleanValue": False},
            "soloVentasProcesadas está activo o tiene un valor inesperado.")
    rows = api("firestore", f"v1/{db}/documents:runAggregationQuery", {
        "structuredAggregationQuery": {
            "structuredQuery": {"from": [{"collectionId": "solicitudesVenta", "allDescendants": True}]},
            "aggregations": [{"alias": "total", "count": {"upTo": "1"}}]
        }
    })
    counts = [r["result"]["aggregateFields"]["total"]["integerValue"] for r in rows if "result" in r]
    require(counts == ["0"], "hay solicitudes existentes o no se pudo demostrar que son cero.")

def ruleset():
    return api("firebaserules", "v1/" + release)["rulesetName"]

def check_trigger_absent():
    path = f"v1/{p}/locations/nam5/triggers"
    page = api("eventarc", path)
    while True:
        for item in page.get("triggers", []):
            dest = item.get("destination", {}).get("cloudRun", {})
            vals = {f["attribute"]: f["value"] for f in item.get("eventFilters", [])}
            require(dest.get("service") != name.lower() and vals.get("document") != pattern,
                    "ya existe un disparador para el destino o el patrón de solicitudes.")
        cursor = page.get("nextPageToken")
        if not cursor:
            return
        page = api("eventarc", path + "?pageToken=" + quote(cursor, safe=""))

meta = api("firebase", "v1beta1/" + p)
require(meta.get("projectId") == project and meta.get("state") == "ACTIVE", "proyecto inesperado o inactivo.")
number = str(meta["projectNumber"])
require(number == "570684941224", "el número del proyecto no coincide con el inventario autorizado.")
try:
    hierarchy = api("cloudresourcemanager", "v3/" + p)
    project_root = hierarchy.get("projectId") == project and not hierarchy.get("parent")
except ApiError:
    project_root = False
apis = ["cloudfunctions", "run", "eventarc", "pubsub", "firestore", "firebaserules",
        "cloudbuild", "artifactregistry", "storage", "logging"]
api_problems = []
for service in apis:
    try:
        info = api("serviceusage", f"v1/projects/{number}/services/{service}.googleapis.com")
        if info.get("state") != "ENABLED":
            api_problems.append(f"API deshabilitada: {service}.googleapis.com")
    except ApiError as error:
        api_problems.append(str(error))
require(not api_problems, "API pendientes:\n- " + "\n- ".join(api_problems))
database = api("firestore", "v1/" + db)
require(database.get("name") == db and database.get("locationId") == "nam5"
        and database.get("type") == "FIRESTORE_NATIVE", "Firestore no coincide con (default), Native, nam5.")
roots = api("firestore", f"v1/{db}/documents:listCollectionIds", {"pageSize": 1000})
collections = set(roots.get("collectionIds", []))
require({"logins", "usuarios"} <= collections, "faltan las colecciones de identidad POS esperadas.")
print("Colecciones POS detectadas:", ", ".join(sorted(collections & {
    "logins", "usuarios", "productos", "cajas", "ajustes", "ventas", "eventos", "movimientos"
})), flush=True)
runtimes = api("cloudfunctions", f"v2/{parent}/runtimes").get("runtimes", [])
require(any(r.get("name") == "nodejs22" and r.get("environment") == "GEN_2"
            and r.get("stage") == "GA" for r in runtimes), "Node.js 22 gen 2 no figura como disponible.")
require(api("cloudfunctions", "v2/" + fn, absent=True) is None, "la función ya existe.")
require(api("run", f"v2/{parent}/services/{name.lower()}", absent=True) is None,
        "ya existe el servicio Cloud Run de destino.")
check_trigger_absent()

baseline = ruleset()
active = api("firebaserules", "v1/" + baseline).get("source", {}).get("files", [])
require(active, "no se pudo leer el ruleset activo.")
for f in active:
    # Acepta los bloques de denegación explícita habituales y rechaza rutas de alcance ambiguo.
    source = f["content"]
    source = re.sub(r"match\s+/\{[^{}]+\}\s*\{\s*allow\s+[\w,\s]+:\s*if\s+false\s*;\s*\}", "", source)
    source = re.sub(r"\bmatch\s+/databases/\{\w+\}/documents", "", source)
    require("solicitudesVenta" not in source and not re.search(r"\bmatch\s+/\{|=\s*\*\*", source),
            "las reglas activas pueden alcanzar la ruta de solicitudes; revisarlas antes del despliegue.")
firestore_state()
with zipfile.ZipFile(archive) as package:
    config = json.loads(package.read("package.json"))
    require(config["engines"]["node"] == "22" and config["main"] == "index.cjs"
            and name.encode() in package.read("index.cjs")
            and pattern.encode() in package.read("index.cjs")
            and "package-lock.json" in package.namelist(), "paquete de la candidata incompatible.")

print(f"Proyecto: {project} | SHA: {sha} | Cuenta: {account} | Ruleset: {baseline}", flush=True)
if not identities:
    with open("/dev/tty") as tty:
        print("Cuenta compartida o tres cuentas (ejecución Eventarc compilación): ",
              end="", file=sys.stderr, flush=True)
        identities = tty.readline().split()
if len(identities) == 1:
    identities *= 3
require(len(identities) == 3 and all(
    re.fullmatch(r"[A-Za-z0-9_.-]+@[A-Za-z0-9.-]+\.[A-Za-z0-9-]+", sa) for sa in identities),
    "indica un correo compartido o tres correos de cuentas de servicio.")

problems = []
for sa in dict.fromkeys(identities):
    try:
        details = api("iam", f"v1/{p}/serviceAccounts/" + quote(sa, safe="@"))
    except ApiError as error:
        problems.append(f"no se pudo verificar {sa}: {error}")
        continue
    if details.get("email") != sa or str(details.get("projectId")) not in {project, str(number)}:
        problems.append(f"IAM no confirma que {sa} pertenezca a {project}.")
    elif details.get("disabled", False):
        problems.append(f"cuenta deshabilitada: {sa}")

require(not problems, "identidades pendientes:\n- " + "\n- ".join(problems))
runtime, trigger, builder = identities
agent = f"service-{number}@gcf-admin-robot.iam.gserviceaccount.com"
agent_member = "serviceAccount:" + agent
agent_role = "roles/cloudfunctions.serviceAgent"
trigger_member = "serviceAccount:" + trigger
receiver_role = "roles/eventarc.eventReceiver"
invoker_role = "roles/run.invoker"
policy = project_policy()
restore_agent = not has_binding(policy, agent_role, agent_member)
agent_path = f"v1/{p}/serviceAccounts/{quote(agent, safe='@')}"
try:
    managed_identity = api("iam", agent_path, absent=True)
except ApiError as error:
    if "HTTP 403" not in str(error):
        raise
    managed_identity = None
provision_agent = managed_identity is None
if managed_identity is not None:
    require(managed_identity.get("email") == agent and not managed_identity.get("disabled", False),
            "la identidad administrada no coincide o está deshabilitada.")
receive = True if has_binding(policy, receiver_role, trigger_member) else allow_evidence(
    f"//cloudresourcemanager.googleapis.com/projects/{number}",
    trigger_member, "eventarc.events.receiveEvent", policy)
grant_receiver = receive is False
project_checks = ["cloudfunctions.functions.create", "cloudfunctions.functions.sourceCodeSet",
                  "serviceusage.services.use"]
if restore_agent or grant_receiver:
    project_checks.append("resourcemanager.projects.setIamPolicy")
if provision_agent:
    project_checks.append("serviceusage.services.generateServiceIdentity")
missing = project_permissions(project_checks)
if missing:
    problems.append("permisos del llamante para este plan: " + ", ".join(missing))
for sa in dict.fromkeys(identities):
    endpoint = f"v1/{p}/serviceAccounts/{quote(sa, safe='@')}:testIamPermissions"
    if missing_permissions("iam", endpoint, ("iam.serviceAccounts.actAs",)):
        problems.append(f"falta iam.serviceAccounts.actAs sobre {sa}.")
require(not problems, "IAM pendiente:\n- " + "\n- ".join(problems))

print("Plan para confirmar con el POS y sus clientes cerrados:", flush=True)
if provision_agent:
    print(f"- Aprovisionar o recuperar la identidad administrada {agent} con Service Usage.")
if restore_agent:
    print(f"- Restaurar {agent_role} a {agent} exclusivamente en {project}.")
if grant_receiver:
    print(f"- Conceder {receiver_role} a {trigger} en {project}; el análisis de Allow no encontró concesión.")
elif receive is None:
    print("- La API de despliegue validará Eventarc; la visibilidad de concesiones del disparador es parcial.")
print(f"- Crear exclusivamente {name} gen 2 del SHA {sha}.")
print(f"- Si no consta una concesión de invocación aplicable, añadir {invoker_role} a {trigger} "
      f"solo en el servicio privado {name.lower()}.", flush=True)
with open("/dev/tty") as tty:
    print("Si autorizas este plan y los clientes y el piloto están cerrados, escribe AUTORIZO_POS_V243: ",
          end="", file=sys.stderr, flush=True)
    confirmation = tty.readline().strip()
require(confirmation == "AUTORIZO_POS_V243", "el plan y el cierre de clientes no fueron confirmados.")
require(ruleset() == baseline, "el ruleset cambió mientras se esperaba la confirmación.")
firestore_state()
check_trigger_absent()
if provision_agent:
    generated = gcloud("beta", "services", "identity", "create", "--service=cloudfunctions.googleapis.com",
                       capture=True)
    issued = agent in re.findall(r"[\w.-]+@[\w.-]+", generated)
    for attempt in range(12):
        try:
            managed_identity = api("iam", agent_path, absent=True)
        except ApiError as error:
            if "HTTP 403" not in str(error):
                raise
            break
        if managed_identity is not None or issued:
            break
        time.sleep(5)
    require((issued if managed_identity is None else
             managed_identity.get("email") == agent and not managed_identity.get("disabled", False)),
            f"Service Usage no confirmó la identidad administrada esperada {agent}.")
if restore_agent:
    project_binding(agent_role, agent_member)
    print(f"Restaurado {agent_role} para {agent}.", flush=True)
if grant_receiver:
    project_binding(receiver_role, trigger_member)
    print(f"Concedido {receiver_role} a {trigger}.", flush=True)
if provision_agent or restore_agent or grant_receiver:
    # Espera breve antes de consumir nuevas concesiones. La API de despliegue valida su aplicación efectiva.
    time.sleep(30)
require(ruleset() == baseline, "el ruleset activo cambió durante el preflight.")
firestore_state()
print("Preflight aprobado. Iniciando exclusivamente el alta de la función.", flush=True)
prepare = api("cloudfunctions", f"v2/{parent}/functions:generateUploadUrl", {"environment": "GEN_2"})
upload = prepare["uploadUrl"]
url = urlsplit(upload)
require(url.scheme == "https" and url.hostname == "storage.googleapis.com",
        "el destino firmado no es Cloud Storage.")
contents = Path(archive).read_bytes()
try:
    with urlopen(Request(upload, data=contents, method="PUT",
                         headers={"Content-Type": "application/zip"}), timeout=120):
        pass
except (URLError, TimeoutError):
    sys.exit("BLOQUEADO: falló la carga del ZIP de la función; no se solicitó su creación.")

filters = [{"attribute": "database", "value": "(default)"},
           {"attribute": "namespace", "value": "(default)"},
           {"attribute": "document", "value": pattern, "operator": "match-path-pattern"}]
require(ruleset() == baseline, "el ruleset cambió antes de solicitar el alta.")
check_trigger_absent()
firestore_state()
operation = api("cloudfunctions", f"v2/{parent}/functions?functionId={name}", {
    "name": fn, "environment": "GEN_2",
    "labels": {"pos-source-sha": sha},
    "buildConfig": {"runtime": "nodejs22", "entryPoint": name,
                    "serviceAccount": f"{p}/serviceAccounts/{builder}",
                    "source": {"storageSource": prepare["storageSource"]}},
    "serviceConfig": {"serviceAccountEmail": runtime, "ingressSettings": "ALLOW_INTERNAL_ONLY"},
    "eventTrigger": {"triggerRegion": "nam5", "eventType": event, "eventFilters": filters,
                     "retryPolicy": "RETRY_POLICY_RETRY", "serviceAccountEmail": trigger}
})
op = operation["name"]
print("Operación:", op, "| ZIP SHA-256:", hashlib.sha256(contents).hexdigest(), flush=True)
deadline = time.monotonic() + 1500
while not operation.get("done"):
    require(time.monotonic() < deadline, f"operación aún en curso ({op}); consulta su estado antes de repetir.")
    time.sleep(10)
    operation = api("cloudfunctions", "v2/" + op)
require("error" not in operation, f"operación fallida: {operation.get('error')}; revisa {op} antes de repetir.")

access_token = token()
function = api("cloudfunctions", "v2/" + fn)
build, svc, tr = (function[k] for k in ("buildConfig", "serviceConfig", "eventTrigger"))
require(function.get("state") == "ACTIVE" and function.get("environment") == "GEN_2"
        and function.get("labels", {}).get("pos-source-sha") == sha
        and build.get("runtime") == "nodejs22" and build.get("entryPoint") == name
        and svc.get("serviceAccountEmail") == runtime and svc.get("ingressSettings") == "ALLOW_INTERNAL_ONLY"
        and tr.get("serviceAccountEmail") == trigger and tr.get("retryPolicy") == "RETRY_POLICY_RETRY"
        and tr.get("eventType") == event,
        f"el alta existe pero sus metadatos no coinciden; revisa {op}.")
target = svc["service"].split("/")[-1]
require(svc["service"] in {f"{parent}/services/{name.lower()}",
        f"projects/{number}/locations/us-central1/services/{name.lower()}"},
        "el destino Cloud Run no coincide con el servicio autorizado.")
require(tr["trigger"].split("/")[3] == "nam5", "ubicación inesperada del disparador creado.")
for _ in range(24):
    ev = api("eventarc", "v1/" + tr["trigger"])
    run = api("run", "v2/" + svc["service"])
    conditions = ev.get("conditions", {})
    revision = run.get("latestReadyRevision", "").split("/")[-1]
    if (conditions and all(c.get("code", "OK") == "OK" for c in conditions.values())
        and run.get("terminalCondition", {}).get("state") == "CONDITION_SUCCEEDED" and revision):
        break
    time.sleep(10)
else:
    sys.exit(f"BLOQUEADO: el alta existe, pero Eventarc o Cloud Run aún no se verifican. Revisa {op}.")
destination = ev.get("destination", {}).get("cloudRun", {})
actual = {x["attribute"]: (x["value"], x.get("operator", "")) for x in ev["eventFilters"]}
require(destination.get("service") == target and destination.get("region") == "us-central1"
        and ev.get("serviceAccount") == trigger and ev.get("transport", {}).get("pubsub", {}).get("subscription")
        and actual.get("type") == (event, "") and actual.get("database") == ("(default)", "")
        and actual.get("document") == (pattern, "match-path-pattern")
        and actual.get("namespace") == ("(default)", "")
        and not run.get("invokerIamDisabled", False)
        and revision == svc.get("revision", "").split("/")[-1]
        and sum(t.get("percent", 0) for t in run.get("trafficStatuses", [])
                if t.get("revision", "").split("/")[-1] == revision) == 100,
        f"el alta existe, pero el destino, los filtros o la revisión no coinciden; revisa {op}.")
def run_policy():
    return api("run", "v2/" + svc["service"] + ":getIamPolicy?options.requestedPolicyVersion=3")

def require_private(iam_policy):
    require(not any({"allUsers", "allAuthenticatedUsers"} & set(b.get("members", []))
                    for b in iam_policy.get("bindings", [])), "el servicio tiene un principal público en IAM.")

policy = run_policy()
require_private(policy)
svc_resource = "//run.googleapis.com/" + svc["service"]
invoke = (has_binding(policy, invoker_role, trigger_member)
          or has_binding(project_policy(), invoker_role, trigger_member)
          or direct_permission(project_policy(), trigger_member, "run.routes.invoke")
          or allow_evidence(svc_resource, trigger_member, "run.routes.invoke", policy))
if not invoke:
    lack = missing_permissions("run", "v2/" + svc["service"] + ":testIamPermissions",
                               ("run.services.setIamPolicy",))
    require(not lack, f"el alta existe, pero falta autorización para configurar la invocación privada de {svc['service']}; revisa {op}.")
    gcloud("run", "services", "add-iam-policy-binding", target, "--region=us-central1",
           "--role=" + invoker_role, "--member=" + trigger_member, "--condition=None")
    policy = run_policy()
    require_private(policy)
    require(has_binding(policy, invoker_role, trigger_member),
            f"el alta existe, pero no se verificó la concesión privada a Eventarc; revisa {op}.")
require(bool(build.get("build")), f"no se encontró el ID de compilación de la función; revisa {op}.")
require(ruleset() == baseline, "el ruleset activo cambió externamente durante el despliegue.")
firestore_state()
print(json.dumps({"estado": "VERIFICADO_ESTRUCTURALMENTE", "proyecto": project, "commit": sha,
                  "funcion": fn, "compilacion": build["build"], "revision": revision, "eventarc": tr["trigger"],
                  "verificacionInvocacion": "politica Allow; entrega de eventos pendiente de una prueba autorizada",
                  "ruleset": baseline, "solicitudes": 0, "ventasDePrueba": 0}, ensure_ascii=False))
PY
