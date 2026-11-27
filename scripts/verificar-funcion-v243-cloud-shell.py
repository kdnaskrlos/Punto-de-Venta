#!/usr/bin/env python3
"""Verifica el alta existente de procesarVentaPos mediante consultas de solo lectura."""
import hashlib
import json
import re
import subprocess
import sys
from urllib.error import HTTPError, URLError
from urllib.parse import urlencode, urlsplit
from urllib.request import Request, urlopen

PROJECT = "punto-de-venta-comic-shop"
NUMBER = "570684941224"
PARENTS = {f"projects/{PROJECT}", f"projects/{NUMBER}"}
P = f"projects/{PROJECT}"
SHA = "fa521e96c86e4052934ec9dcd080aceba06e7443"
FN = "locations/us-central1/functions/procesarVentaPos"
RUN = "locations/us-central1/services/procesarventapos"
EVENTARC = "locations/nam5/triggers/procesarventapos-790966"
REVISION = "procesarventapos-00001-mem"
SA = f"{NUMBER}-compute@developer.gserviceaccount.com"
EVENT = "google.cloud.firestore.document.v1.created"
PATTERN = "usuarios/{uid}/solicitudesVenta/{id}"
DB = f"{P}/databases/(default)"

failures = []
pending = []
role_permissions = {
    "roles/run.invoker": {"run.routes.invoke"},
    "roles/eventarc.eventReceiver": {"eventarc.events.receiveEvent"},
    "roles/pubsub.serviceAgent": {"iam.serviceAccounts.getOpenIdToken"},
    "roles/iam.serviceAccountTokenCreator": {"iam.serviceAccounts.getOpenIdToken"},
    "roles/iam.serviceAccountOpenIdTokenCreator": {"iam.serviceAccounts.getOpenIdToken"},
    "roles/datastore.user": {"datastore.databases.get", "datastore.entities.get",
                            "datastore.entities.create", "datastore.entities.update"}
}
POLICY_VERSION = "options.requestedPolicyVersion=3"


def require(ok, message):
    if not ok:
        failures.append(message)


def resource(value, suffix):
    return value in {f"{parent}/{suffix}" for parent in PARENTS}


def pubsub_resource(value, kind):
    return isinstance(value, str) and any(
        value.startswith(f"{parent}/{kind}/") and
        re.fullmatch(r"[A-Za-z0-9._~+%-]+", value.split("/")[-1]) and value.count("/") == 3
        for parent in PARENTS)


def api(host, path, body=None):
    request = Request(f"https://{host}.googleapis.com/{path}",
                      data=json.dumps(body).encode() if body is not None else None,
                      headers={"Authorization": "Bearer " + token, "Content-Type": "application/json"})
    with urlopen(request, timeout=30) as response:
        return json.load(response)


def read(host, path, body=None):
    try:
        return api(host, path, body)
    except HTTPError as error:
        pending.append(f"{host}/{path.split('?')[0]} HTTP {error.code}")
    except (URLError, TimeoutError, ValueError):
        pending.append(f"{host}/{path.split('?')[0]} sin respuesta utilizable")
    return {}


def grants(policies, member, permission, include_conditions=False):
    for policy in policies:
        for binding in policy.get("bindings", []):
            if member not in binding.get("members", []):
                continue
            if binding.get("condition") and not include_conditions:
                continue
            role = binding["role"]
            if role not in role_permissions:
                role_permissions[role] = set(read("iam", "v1/" + role).get("includedPermissions", []))
            if permission in role_permissions[role]:
                return True
    return False


def allow(policy, scope, principal, permission):
    if grants(policy, principal, permission):
        return "concesión directa sin condición"
    query = urlencode({
        "analysisQuery.resourceSelector.fullResourceName": scope,
        "analysisQuery.identitySelector.identity": principal,
        "analysisQuery.accessSelector.permissions": permission,
        "executionTimeout": "5s"
    })
    try:
        result = api("cloudasset", f"v1/{P}:analyzeIamPolicy?" + query)
    except (HTTPError, URLError, TimeoutError, ValueError):
        return "sin evidencia de Allow"
    analysis = result.get("mainAnalysis", {})
    if result.get("fullyExplored") and not analysis.get("nonCriticalErrors") and any(
        not match.get("iamBinding", {}).get("condition") for match in analysis.get("analysisResults", [])
    ):
        return "concesión Allow visible en Cloud Asset"
    return "sin evidencia de Allow"


def check_allow(policies, scope, member, permission):
    evidence = allow(policies, scope, member, permission)
    if evidence == "sin evidencia de Allow":
        pending.append(f"{permission} de {member} sobre {scope}: sin evidencia suficiente")
    return evidence


def agent_binding(policy, role, email):
    return any(binding.get("role") == role and not binding.get("condition")
               and "serviceAccount:" + email in binding.get("members", [])
               for binding in policy.get("bindings", []))


def verify(repo):
    fn = read("cloudfunctions", f"v2/{P}/{FN}")
    run = read("run", f"v2/{P}/{RUN}")
    trigger = read("eventarc", f"v1/{P}/{EVENTARC}")
    build, svc, event = (fn.get(key, {}) for key in ("buildConfig", "serviceConfig", "eventTrigger"))
    require(fn.get("state") == "ACTIVE" and fn.get("environment") == "GEN_2"
            and fn.get("labels", {}).get("pos-source-sha") == SHA
            and build.get("entryPoint") == "procesarVentaPos" and build.get("runtime") == "nodejs22",
            "Cloud Functions no coincide con el alta autorizada.")
    require(resource(svc.get("service"), RUN) and svc.get("serviceAccountEmail") == SA,
            "El servicio asociado o la cuenta de ejecución difiere.")
    require(resource(event.get("trigger"), EVENTARC) and event.get("eventType") == EVENT
            and event.get("serviceAccountEmail") == SA and event.get("retryPolicy") == "RETRY_POLICY_RETRY",
            "La asociación o la configuración del disparador de Cloud Functions difiere.")

    terminal = run.get("terminalCondition", {}).get("state")
    readiness = {c.get("type"): c.get("state") for c in run.get("conditions", [])}
    require(terminal == "CONDITION_SUCCEEDED" and not run.get("reconciling", False)
            and all(readiness.get(key, "CONDITION_SUCCEEDED") == "CONDITION_SUCCEEDED"
                    for key in ("Ready", "ConfigurationsReady", "RoutesReady")),
            "Cloud Run no consta listo.")
    ready = run.get("latestReadyRevision", "").split("/")[-1]
    latest = run.get("latestCreatedRevision", "").split("/")[-1]
    traffic = [t for t in run.get("trafficStatuses", []) if t.get("percent", 0) > 0]
    def serves_revision(target):
        revision = target.get("revision", "").split("/")[-1]
        return revision == REVISION or (not revision and latest == ready
                and target.get("type") == "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST")
    percent = sum(t["percent"] for t in traffic if serves_revision(t))
    function_revision = svc.get("revision")
    require(ready == REVISION and (not function_revision or function_revision.split("/")[-1] == REVISION)
            and percent == 100 and all(serves_revision(t) for t in traffic), "Revisión o reparto de tráfico distinto al informado.")

    destination = trigger.get("destination", {})
    dest_run = destination.get("cloudRun", {})
    require(resource(trigger.get("name"), EVENTARC) and (
        resource(destination.get("cloudFunction"), FN)
        or (dest_run.get("service") == "procesarventapos" and dest_run.get("region") == "us-central1")
    ), "Eventarc no apunta a la función o al servicio autorizado.")
    filters = {f["attribute"]: (f["value"], f.get("operator", "")) for f in trigger.get("eventFilters", [])}
    require(trigger.get("serviceAccount") == SA and filters.get("type") == (EVENT, "")
            and filters.get("database") == ("(default)", "")
            and filters.get("document") == (PATTERN, "match-path-pattern")
            and filters.get("namespace", ("(default)", "")) == ("(default)", ""),
            "Cuenta, evento o filtros de Firestore distintos de los autorizados.")
    conditions = trigger.get("conditions", {})
    bad_conditions = {key: value.get("code") for key, value in conditions.items()
                      if value.get("code", "OK") not in ("OK", 0)}
    require(not bad_conditions, f"Eventarc devolvió condiciones de error: {bad_conditions}")

    project_policy = read("cloudresourcemanager", f"v3/{P}:getIamPolicy",
                          {"options": {"requestedPolicyVersion": 3}})
    run_policy = read("run", f"v2/{P}/{RUN}:getIamPolicy?{POLICY_VERSION}")
    require(svc.get("ingressSettings") == "ALLOW_INTERNAL_ONLY"
            and run.get("ingress", "INGRESS_TRAFFIC_INTERNAL_ONLY") == "INGRESS_TRAFFIC_INTERNAL_ONLY"
            and not run.get("invokerIamDisabled", False),
            "La entrada interna o la comprobación IAM de Cloud Run difiere.")
    policies = (run_policy, project_policy)
    for member in ("allUsers", "allAuthenticatedUsers"):
        require(not grants(policies, member, "run.routes.invoke", include_conditions=True),
                f"Se observó una concesión de invocación a {member}.")
    agents = {}
    for role, domain in (("roles/cloudfunctions.serviceAgent", "gcf-admin-robot"),
                         ("roles/eventarc.serviceAgent", "gcp-sa-eventarc")):
        email = f"service-{NUMBER}@{domain}.iam.gserviceaccount.com"
        agents[role] = agent_binding(project_policy, role, email)
        if not agents[role]:
            pending.append(f"No se pudo comprobar el enlace {role} para {email}.")

    member = "serviceAccount:" + SA
    iam = {
        "run.routes.invoke": check_allow(policies, f"//run.googleapis.com/{P}/{RUN}", member, "run.routes.invoke"),
        "eventarc.events.receiveEvent": check_allow((project_policy,), f"//cloudresourcemanager.googleapis.com/projects/{NUMBER}",
                                                   member, "eventarc.events.receiveEvent")
    }
    for permission in ("datastore.databases.get", "datastore.entities.get",
                       "datastore.entities.create", "datastore.entities.update"):
        iam[permission] = check_allow((project_policy,), f"//firestore.googleapis.com/{DB}", member, permission)
    sa = read("iam", f"v1/{P}/serviceAccounts/{SA}")
    if sa:
        require(sa.get("email") == SA and str(sa.get("projectId")) in {PROJECT, NUMBER}
                and not sa.get("disabled", False), "La cuenta del disparador no está activa en el proyecto.")

    transport = trigger.get("transport", {}).get("pubsub", {})
    topic, subscription = transport.get("topic"), transport.get("subscription")
    if topic is None or subscription is None:
        pending.append("Eventarc no expuso ambos identificadores de transporte; no se comprobó Pub/Sub.")
    elif not (pubsub_resource(topic, "topics") and pubsub_resource(subscription, "subscriptions")):
        failures.append("Eventarc declara un tema o una suscripción fuera del proyecto esperado.")
    else:
        topic_info = read("pubsub", "v1/" + topic)
        sub_info = read("pubsub", "v1/" + subscription)
        if topic_info:
            require(topic_info.get("name") == topic, "El tema de transporte no coincide.")
        if sub_info:
            require(sub_info.get("name") == subscription and sub_info.get("topic") == topic
                    and sub_info.get("state", "ACTIVE") == "ACTIVE",
                    "La suscripción no está activa o está asociada a otro tema.")
            push = sub_info.get("pushConfig", {})
            if push.get("pushEndpoint"):
                require(urlsplit(push["pushEndpoint"]).scheme == "https", "Push de Pub/Sub usa un destino no HTTPS.")
            push_identity = push.get("oidcToken", {}).get("serviceAccountEmail")
            if push_identity and push_identity != SA:
                pending.append("La identidad OIDC informada por Pub/Sub difiere; revisar el transporte administrado.")
            elif push_identity == SA:
                pubsub_agent = f"serviceAccount:service-{NUMBER}@gcp-sa-pubsub.iam.gserviceaccount.com"
                oidc_permission = "iam.serviceAccounts.getOpenIdToken"
                if not grants((project_policy,), pubsub_agent, oidc_permission):
                    sa_policy = read("iam", f"v1/{P}/serviceAccounts/{SA}:getIamPolicy?{POLICY_VERSION}")
                    iam["pubsub.oidc"] = check_allow(
                        (sa_policy,), f"//iam.googleapis.com/{P}/serviceAccounts/{SA}",
                        pubsub_agent, oidc_permission)
                else:
                    iam["pubsub.oidc"] = "concesión directa sin condición"

    release = read("firebaserules", f"v1/{P}/releases/cloud.firestore")
    ruleset = release.get("rulesetName")
    active = read("firebaserules", "v1/" + ruleset) if ruleset else {}
    active_files = active.get("source", {}).get("files", [])
    if not ruleset or not active_files:
        pending.append("Falta recuperar las reglas activas para preparar la reversión.")
    candidate = subprocess.check_output(["git", "-C", repo, "show", SHA + ":firestore.rules"])
    print(json.dumps({
        "estado": "BLOQUEADO" if failures else "VERIFICACION_PARCIAL" if pending else "VERIFICADO_ESTRUCTURALMENTE",
        "proyecto": PROJECT, "commit": SHA, "funcion": fn.get("name"), "revision": ready,
        "traficoRevisionPorcentaje": percent, "eventarc": trigger.get("name"), "destino": destination,
        "conditions": conditions or "sin condiciones informadas", "agentes": agents, "evidenciaIAMAllow": iam,
        "transporte": {"tema": topic, "suscripcion": subscription}, "entregaRealDeEventos": "sin prueba activa",
        "reglas": {"rulesetActivo": ruleset, "actualizado": release.get("updateTime"),
                   "sha256Candidata": hashlib.sha256(candidate).hexdigest(),
                   "archivosActivos": [{"nombre": f["name"], "sha256": hashlib.sha256(f["content"].encode()).hexdigest()}
                                      for f in active_files]},
        "fallos": failures, "pendientes": pending
    }, ensure_ascii=False, indent=2))
    return 1 if failures else 2 if pending else 0


if __name__ == "__main__":
    token = subprocess.check_output(["gcloud", "auth", "print-access-token"], text=True).strip()
    if not token:
        sys.exit("BLOQUEADO: Cloud Shell no devolvió una credencial activa.")
    sys.exit(verify(sys.argv[1]))
