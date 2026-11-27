#!/usr/bin/env python3
"""Diagnóstico de solo lectura para el alta de procesarVentaPos v2.43."""
import json
import re
import subprocess
from concurrent.futures import ThreadPoolExecutor
from urllib.error import HTTPError, URLError
from urllib.parse import quote
from urllib.request import Request, urlopen

PROJECT = "punto-de-venta-comic-shop"
NUMBER = "570684941224"
P = f"projects/{PROJECT}"
PROJECT_IAM = f"//cloudresourcemanager.googleapis.com/projects/{NUMBER}"
SA = f"{NUMBER}-compute@developer.gserviceaccount.com"
AGENT = f"service-{NUMBER}@gcf-admin-robot.iam.gserviceaccount.com"
EVENTARC_AGENT = f"service-{NUMBER}@gcp-sa-eventarc.iam.gserviceaccount.com"
SA_PATH = f"{P}/serviceAccounts/{SA}"
DB = f"{P}/databases/(default)"
DB_IAM = f"//firestore.googleapis.com/{DB}"
REGION = f"{P}/locations/us-central1"
RUN = f"{REGION}/services/procesarventapos"
DOC = "usuarios/{uid}/solicitudesVenta/{id}"
REPO_IAM = f"//artifactregistry.googleapis.com/{REGION}/repositories/gcf-artifacts"
DEPLOY = ("cloudfunctions.functions.create", "cloudfunctions.functions.sourceCodeSet")
OBSERVER = ("serviceusage.services.use", "resourcemanager.projects.getIamPolicy", "iam.roles.get")
POSTCHECK_READ = ("cloudfunctions.operations.get", "cloudfunctions.functions.get",
                  "run.services.get", "run.services.getIamPolicy", "eventarc.triggers.get")


def cli(*args):
    return subprocess.check_output(["gcloud", *args], text=True).strip()


def api(host, path, body=None, quota=False):
    headers = {"Authorization": "Bearer " + token, "Content-Type": "application/json"}
    if quota:
        headers["x-goog-user-project"] = PROJECT
    request = Request(f"https://{host}.googleapis.com/{path}", headers=headers,
                      data=None if body is None else json.dumps(body).encode())
    try:
        with urlopen(request, timeout=25) as response:
            return response.status, json.load(response)
    except HTTPError as error:
        try:
            detail = json.loads(error.read()).get("error", {})
        except (ValueError, AttributeError):
            detail = {}
        return error.code, detail
    except (URLError, TimeoutError):
        return 0, {"message": "sin respuesta de la API"}


def brief(code, payload):
    info = [d for d in payload.get("details", [])
            if d.get("@type", "").endswith("google.rpc.ErrorInfo")]
    fields = ("permission", "consumer", "service", "resource")
    tags = [(d.get("reason"), {k: d.get("metadata", {})[k] for k in fields
                              if k in d.get("metadata", {})}) for d in info]
    return f"HTTP {code or 'sin conexión'} | {payload.get('message', '')} | {tags}"


def read(label, host, path, body=None):
    code, result = api(host, path, body)
    if code == 200:
        return result
    print(f"{label}: {brief(code, result)}")
    return None


def own_permissions(label, host, path, permissions):
    print(label)
    result = read(label, host, path, {"permissions": list(permissions)})
    if result is None:
        print("  INDETERMINADO para la identidad que firmó el token.")
        return None
    granted = set(result.get("permissions", []))
    for permission in permissions:
        print(f"  {'PRESENTE' if permission in granted else 'NO DEVUELTO'} {permission}")
    return granted


def troubleshoot(principal, resource, permission):
    return api("policytroubleshooter", "v3/iam:troubleshoot", {"accessTuple": {
        "principal": principal, "fullResourceName": resource, "permission": permission
    }}, quota=True)


def advise(text):
    print("  PROPUESTA CONDICIONAL:", text)


def report(check, result):
    principal, resource, permission, proposal = check
    code, detail = result
    if code != 200:
        print(f"  INDETERMINADO {principal} | {permission} | {resource} | {brief(code, detail)}")
        return
    state = detail.get("overallAccessState", "INDETERMINADO")
    print(f"  {state} {principal} | {permission} | {resource}")
    deny = detail.get("denyPolicyExplanation", {}).get("denyAccessState")
    allow = detail.get("allowPolicyExplanation", {}).get("allowAccessState")
    if state == "CANNOT_ACCESS" and allow == "ALLOW_ACCESS_STATE_NOT_GRANTED" and deny == "DENY_ACCESS_STATE_NOT_DENIED":
        advise(proposal)
    elif state == "CANNOT_ACCESS":
        print(f"  Revisar la política aplicable con el revisor IAM. Allow={allow}; Deny={deny}.")
    elif state != "CAN_ACCESS":
        print("  Revisar visibilidad de políticas y roles personalizados o condiciones IAM con un revisor existente.")


def metadata():
    services = ("cloudfunctions", "run", "eventarc", "pubsub", "firestore", "firebaserules",
                "cloudbuild", "artifactregistry", "storage", "logging", "policytroubleshooter")
    with ThreadPoolExecutor(max_workers=5) as pool:
        states = pool.map(lambda s: api("serviceusage",
                          f"v1/projects/{NUMBER}/services/{s}.googleapis.com"), services)
        for service, (code, result) in zip(services, states):
            print(f"  {service}.googleapis.com: {result.get('state') if code == 200 else brief(code, result)}")

    db = read("Firestore", "firestore", "v1/" + DB)
    if db is not None:
        print("  Firestore:", db.get("type"), db.get("locationId"), "esperado FIRESTORE_NATIVE nam5")
    state = read("Interruptor POS", "firestore", f"v1/{DB}/documents/sistema/estado?mask.fieldPaths=soloVentasProcesadas")
    if state is not None:
        flag = state.get("fields", {}).get("soloVentasProcesadas")
        print("  soloVentasProcesadas:", "compatible" if flag is None or flag == {"booleanValue": False} else "BLOQUEO")
    rows = read("Solicitudes", "firestore", f"v1/{DB}/documents:runAggregationQuery", {
        "structuredAggregationQuery": {
            "structuredQuery": {"from": [{"collectionId": "solicitudesVenta", "allDescendants": True}]},
            "aggregations": [{"alias": "total", "count": {"upTo": "1"}}]}})
    if rows is not None:
        totals = [r["result"]["aggregateFields"]["total"].get("integerValue") for r in rows if "result" in r]
        print("  Solicitudes:", "0" if totals == ["0"] else "BLOQUEO: al menos una o respuesta indeterminada")

    release = read("Reglas activas", "firebaserules", f"v1/{P}/releases/cloud.firestore")
    if release and release.get("rulesetName"):
        print("  Ruleset:", release["rulesetName"])
        active = read("Fuente de reglas", "firebaserules", "v1/" + release["rulesetName"])
        if active is not None:
            files = active.get("source", {}).get("files", [])
            compatible = bool(files)
            for f in files:
                source = re.sub(r"match\s+/\{[^{}]+\}\s*\{\s*allow\s+[\w,\s]+:\s*if\s+false\s*;\s*\}", "", f["content"])
                source = re.sub(r"\bmatch\s+/databases/\{\w+\}/documents", "", source)
                compatible &= "solicitudesVenta" not in source and not re.search(r"\bmatch\s+/\{|=\s*\*\*", source)
            print("  Comprobación conservadora de reglas:", "compatible" if compatible else "BLOQUEO: revisar alcance")

    resources = (
        ("Función", "cloudfunctions", f"v2/{REGION}/functions/procesarVentaPos"),
        ("Cloud Run", "run", "v2/" + RUN),
        ("Repositorio de compilación", "artifactregistry", f"v1/{REGION}/repositories/gcf-artifacts"),
    )
    for label, host, path in resources:
        code, result = api(host, path)
        if code == 200:
            print(f"  {label}: existe ({result.get('state', result.get('name', 'detectado'))}).")
        elif code == 404:
            print(f"  {label}: ausente en la consulta (HTTP 404).")
        else:
            print(f"  {label}: {brief(code, result)}")
    sources = read("Buckets regionales de fuentes", "storage",
                   f"storage/v1/b?project={PROJECT}&prefix=gcf-v2-&fields=items(name,location),nextPageToken")
    if sources is not None:
        print("  Fuentes GCF detectadas:", ", ".join(
            b["name"] for b in sources.get("items", []) if b.get("location", "").lower() == "us-central1")
            or "sin bucket regional visible; puede provisionarse en el primer despliegue")
    runtime = read("Runtimes", "cloudfunctions", f"v2/{REGION}/runtimes")
    if runtime is not None:
        print("  Node.js 22 gen 2 GA:", any(
            r.get("name") == "nodejs22" and r.get("environment") == "GEN_2" and r.get("stage") == "GA"
            for r in runtime.get("runtimes", [])), "en us-central1")
    path = f"v1/{P}/locations/nam5/triggers"
    cursor = ""
    while True:
        items = read("Disparadores Eventarc", "eventarc", path + cursor)
        if items is None:
            break
        for trigger in items.get("triggers", []):
            dest = trigger.get("destination", {}).get("cloudRun", {}).get("service")
            document = next((f.get("value") for f in trigger.get("eventFilters", [])
                             if f.get("attribute") == "document"), None)
            if document == DOC or dest == "procesarventapos":
                print("  BLOQUEO: disparador coincidente", trigger.get("name"))
        if not items.get("nextPageToken"):
            print("  Inventario de disparadores en nam5 consultado.")
            break
        cursor = "?pageToken=" + quote(items["nextPageToken"], safe="")


def main():
    config = cli("config", "get-value", "auth/impersonate_service_account", "--quiet")
    if config and config != "(unset)":
        raise SystemExit("Selecciona una sesión de Cloud Shell sin impersonación configurada para atribuir el diagnóstico a la cuenta activa.")
    account = cli("auth", "list", "--filter=status:ACTIVE", "--format=value(account)")
    if not account or "\n" in account:
        raise SystemExit("Se requiere una única cuenta activa de Cloud Shell.")
    global token
    token = cli("auth", "print-access-token", "--account", account)
    if not token:
        raise SystemExit("La cuenta activa no produjo un token de acceso.")
    print(f"Proyecto {PROJECT} | Llamante {account} | Identidad de función {SA}")
    meta = read("Proyecto", "cloudresourcemanager", "v3/" + P)
    if meta is not None and (meta.get("name") != f"projects/{NUMBER}" or meta.get("projectId") != PROJECT):
        raise SystemExit("Proyecto inesperado. Se detuvo el diagnóstico.")

    print("\n1. Permisos del llamante de Cloud Shell")
    own = own_permissions("Proyecto, vía testIamPermissions", "cloudresourcemanager",
                          f"v3/{P}:testIamPermissions", OBSERVER + DEPLOY)
    sa = read("Cuenta de Compute Engine", "iam", "v1/" + SA_PATH)
    if sa is not None:
        print("  Cuenta de servicio activa y del proyecto:", sa.get("email") == SA
              and str(sa.get("projectId")) in {PROJECT, NUMBER} and not sa.get("disabled", False))
    act_as = own_permissions("Cuenta de servicio, vía testIamPermissions", "iam",
                             f"v1/{SA_PATH}:testIamPermissions", ("iam.serviceAccounts.actAs",))
    if own is not None:
        if "serviceusage.services.use" not in own:
            advise(f"Confirmar ausencia de concesión para {account}; solo si se confirma, Service Usage Consumer o permiso equivalente en {PROJECT}. Se usa para cuota y se comprueba en el alta.")
        missing = [x for x in DEPLOY if x not in own]
        if missing:
            advise(f"Si falta una concesión y no hay Deny/PAB, rol personalizado para {account} en {PROJECT} limitado a {', '.join(missing)}.")
    if act_as == set():
        advise(f"Si falta una concesión y no hay Deny/PAB, roles/iam.serviceAccountUser para {account} sobre {SA} únicamente.")

    own_permissions("Visibilidad de operaciones y recursos futuros a nivel de proyecto",
                    "cloudresourcemanager", f"v3/{P}:testIamPermissions", POSTCHECK_READ)

    print("\n2. Llamada de control a Policy Troubleshooter v3")
    probe = (account, PROJECT_IAM, "resourcemanager.projects.getIamPolicy")
    code, result = troubleshoot(*probe)
    if code != 200:
        print("  La solicitud de diagnóstico no fue autorizada o no pudo completarse:", brief(code, result))
        if code == 403:
            print("  Este 403 corresponde al llamante de la API; los permisos de la cuenta de servicio siguen indeterminados.")
            if own is None or "resourcemanager.projects.getIamPolicy" not in own:
                print("  Verificar visibilidad de la política del proyecto con un revisor IAM ya autorizado.")
            print("  Si la cuota y la visibilidad están confirmadas, revisar ErrorInfo, políticas Deny/PAB, VPC Service Controls o GetEffectivePolicy en auditoría con un revisor existente.")
    else:
        print("  Consulta autorizada; estado devuelto:", result.get("overallAccessState"))

    print("\n3. Permisos de ejecución, Eventarc, compilación y agentes")
    artifact_code, _ = api("artifactregistry", f"v1/{REGION}/repositories/gcf-artifacts")
    checks = [(SA, DB_IAM, perm, f"Rol personalizado sin borrado, limitado a (default), solo para los permisos Firestore confirmados como faltantes.")
              for perm in ("datastore.databases.get", "datastore.entities.get", "datastore.entities.create", "datastore.entities.update")]
    checks += [
        (SA, PROJECT_IAM, "eventarc.events.receiveEvent", "roles/eventarc.eventReceiver para la identidad del disparador en este proyecto."),
        (SA, PROJECT_IAM, "run.routes.invoke", "Este chequeo corresponde al proyecto porque el destino aún puede no existir. Si falta, preparar aparte el enlace al servicio privado específico cuando exista; no ampliar la invocación a todo el proyecto."),
        (SA, PROJECT_IAM, "logging.logEntries.create", "roles/logging.logWriter para la identidad de compilación, en este proyecto."),
        (SA, PROJECT_IAM, "storage.objects.get", "La prueba a nivel de proyecto no descarta permisos en el bucket. Comprobar los objetos de fuentes efectivos antes de proponer acceso de lectura solo al bucket o prefijo de compilación."),
        (SA, REPO_IAM if artifact_code == 200 else PROJECT_IAM, "artifactregistry.repositories.uploadArtifacts",
         "Comprobar el repositorio efectivo y, si falta, roles/artifactregistry.writer solo en dicho repositorio."),
        (AGENT, PROJECT_IAM, "run.services.create", "Restaurar roles/cloudfunctions.serviceAgent solo al agente administrado si se confirma que su enlace predeterminado fue retirado."),
        (AGENT, PROJECT_IAM, "eventarc.triggers.create", "Restaurar roles/cloudfunctions.serviceAgent solo al agente administrado si se confirma que su enlace predeterminado fue retirado."),
    ]
    run_code, _ = api("run", "v2/" + RUN)
    if run_code == 200:
        checks.append((SA, "//run.googleapis.com/" + RUN, "run.routes.invoke",
                       "roles/run.invoker para la identidad del disparador solo en este servicio."))
    if code == 200:
        with ThreadPoolExecutor(max_workers=4) as pool:
            results = pool.map(lambda c: troubleshoot(*c[:3]), checks)
            for check, result in zip(checks, results):
                report(check, result)
    else:
        for who, resource, perm, _ in checks:
            print(f"  INDETERMINADO {who} | {perm} | {resource}")

    policy = read("Política directa del proyecto", "cloudresourcemanager", f"v3/{P}:getIamPolicy",
                  {"options": {"requestedPolicyVersion": 3}})
    if policy is not None:
        bindings = policy.get("bindings", [])
        for who, role in ((AGENT, "roles/cloudfunctions.serviceAgent"),
                          (EVENTARC_AGENT, "roles/eventarc.serviceAgent")):
            direct = any(b.get("role") == role and "serviceAccount:" + who in b.get("members", [])
                         and not b.get("condition") for b in bindings)
            print(f"  Enlace directo sin condición de {role}: {direct}.", end=" ")
            print("La ausencia puede corresponder a la primera provisión o a una política heredada.")
        relevant = {"roles/datastore.user", "roles/eventarc.eventReceiver", "roles/run.invoker",
                    "roles/storage.objectViewer", "roles/artifactregistry.writer", "roles/logging.logWriter"}
        direct = sorted({b["role"] + (" (condicional)" if b.get("condition") else "")
                         for b in bindings if b.get("role") in relevant
                         and "serviceAccount:" + SA in b.get("members", [])})
        print("  Enlaces directos relevantes de Compute (visibilidad parcial):", ", ".join(direct) or "ninguno visible")
        for role in ("roles/owner", "roles/editor"):
            if any(b.get("role") == role and "serviceAccount:" + SA in b.get("members", []) for b in bindings):
                print(f"  La cuenta de Compute tiene un enlace directo {role}; no usar ese rol como ajuste.")
    print("\n4. Comprobaciones restantes de solo lectura")
    metadata()
    print("\nFIN DEL DIAGNÓSTICO: la autorización de despliegue se evalúa por separado.")


if __name__ == "__main__":
    main()
