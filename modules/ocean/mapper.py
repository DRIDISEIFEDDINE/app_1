from datetime import datetime


def compute_age(date_str):
    if not date_str:
        return ""

    start = datetime.fromisoformat(date_str.replace("Z", ""))
    diff = datetime.now() - start

    return f"{diff.days}j {diff.seconds//3600}h"


def map_ticket(data):

    result = {}

    result["ticket"] = data.get("id")

    # MSISDN
    for c in data.get("troubleTicketCharacteristic", []):
        if c.get("id") == "MSISDN":
            result["msisdn"] = c.get("value")

    # Client / Service
    for s in data.get("relatedService", {}).get("serviceSpecCharacteristic", []):
        if s.get("name") == "Identifiant 1 du produit":
            result["client_id"] = s.get("value")

    # Nom client
    for s in data.get("relatedService", {}).get("serviceCharacteristic", []):
        if s.get("name") == "Contact (Nom Prénom)":
            result["nom"] = s.get("value")

    # Site
    try:
        result["site"] = data["relatedService"]["supportingResource"][0]["place"]["name"]
    except:
        result["site"] = ""

    # Mobile
    try:
        result["mobile"] = data["relatedService"]["supportingResource"][0]["relatedParty"][0]["contactMedium"][0]["medium"]["number"]
    except:
        result["mobile"] = ""

    # Statut
    status = next((s for s in data.get("status", []) if s.get("isCurrentStatus")), {})
    result["status"] = status.get("code")

    # Age
    result["age"] = compute_age(status.get("startDate"))

    return result