# -*- coding: utf-8 -*-
import requests
import json

BASE_URL = "http://10.27.66.66:38444"

CREDENTIALS_FILE = "/home/multiservice/app_1/config/credentials.txt"
TOKEN_FILE = "/home/multiservice/app_1/TEMP/oauth_token.txt"
TECH_FILE = "/home/multiservice/app_1/config/techniciens.json"


# ================================
# 🔹 LOADERS
# ================================

def load_credentials():
    creds = {}
    with open(CREDENTIALS_FILE) as f:
        for line in f:
            key, value = line.strip().split("=")
            creds[key.strip()] = value.strip()
    return creds


def get_token():
    try:
        with open(TOKEN_FILE) as f:
            token = f.read().strip()
            if not token:
                raise Exception("Token vide")
            return token
    except:
        print("❌ Token invalide")
        return None


def load_technicians():
    with open(TECH_FILE) as f:
        return json.load(f)


def extract_status(ticket):
    for s in ticket.get("status", []):
        if s.get("isCurrentStatus"):
            return s.get("code")
    return "N/A"


def extract_msisdn(ticket):
    for c in ticket.get("troubleTicketCharacteristic", []):
        if c.get("id") == "MSISDN":
            return c.get("value")
    return None


# ================================
# 🔹 SEARCH BACKLOG (SANS GET)
# ================================

def search_tickets_by_user(cuid):

    print("\n==============================")
    print(f"BACKLOG UTILISATEUR: {cuid}")
    print("==============================")

    creds = load_credentials()
    techs = load_technicians()

    user = techs.get(cuid)
    if not user:
        print("❌ Technicien inconnu")
        return

    eds_list = [e["id"] if isinstance(e, dict) else e for e in user["eds"]]

    print(f"Utilisateur: {user.get('name')} | EDS: {eds_list}")

    token = get_token()
    if not token:
        return

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "accept": "*/*"
    })

    auth = {
        "username": creds["username"],
        "password": creds["password"],
        "cuid": creds["cuid"]
    }

    all_tickets = {}

    roles = ["TroubleResolutionContributor", "TroubleResolutionLeader", "LastActor"]

    for eds in eds_list:

        print(f"\nRecherche EDS: {eds}")

    for role in roles:

        payloads = []

        # base
        payloads.append({
            "relatedParty": [{"id": eds, "role": role}]
        })

        # priority split (tu gardes si besoin)
        for i in range(6):
            payloads.append({
                "relatedParty": [{"id": eds, "role": role}],
                "priority": {"id": i}
            })

        # urgency split (tu gardes si besoin)
        for u in range(10):
            payloads.append({
                "relatedParty": [{"id": eds, "role": role}],
                "urgency": {"id": u}
            })

        # appels API
        for payload in payloads:

            try:
                r = session.post(
                    f"{BASE_URL}/searchTicket-oceane",
                    params=auth,
                    json=payload,
                    timeout=15
                )

                if r.status_code != 200:
                    continue

                data = r.json()

                if isinstance(data, list):
                    for t in data:
                        if "id" in t:
                            all_tickets[t["id"]] = t

            except:
                continue

    print(f"\nTOTAL FINAL: {len(all_tickets)} tickets\n")

    if not all_tickets:
        return

    # 🔥 LISTE IDS
    print("LISTE DES TICKETS:\n")
    for i, tid in enumerate(sorted(all_tickets.keys())):
        print(f"{i+1}. {tid}")

    print("\n" + "="*50)

    # 🔥 APERÇU
    print("\nAPERÇU (10 tickets):\n")

    for i, t in enumerate(list(all_tickets.values())[:10]):
        print(f"{i+1}. Ticket : {t.get('id')}")
        print("   Statut :", extract_status(t))
        print("   Type   :", t.get("ticketType", {}).get("label"))
        print("   MSISDN :", extract_msisdn(t))
        print("-"*40)


# ================================
# 🔹 SEARCH TICKET LOCAL
# ================================

def find_ticket_local(ticket_id, cuid):

    print("\n==============================")
    print(f"RECHERCHE LOCALE: {ticket_id}")
    print("==============================")

    creds = load_credentials()
    techs = load_technicians()

    user = techs.get(cuid)
    if not user:
        print("❌ Technicien inconnu")
        return

    eds_list = [e["id"] if isinstance(e, dict) else e for e in user["eds"]]

    token = get_token()
    if not token:
        return

    session = requests.Session()
    session.headers.update({
        "Authorization": f"Bearer {token}",
        "Content-Type": "application/json",
        "accept": "*/*"
    })

    auth = {
        "username": creds["username"],
        "password": creds["password"],
        "cuid": creds["cuid"]
    }

    roles = ["TroubleResolutionContributor", "TroubleResolutionLeader", "LastActor"]

    for eds in eds_list:
        print(f"🔎 Scan EDS {eds}")

        for role in roles:

            payload = {
                "relatedParty": [{"id": eds, "role": role}]
            }

            try:
                r = session.post(
                    f"{BASE_URL}/searchTicket-oceane",
                    params=auth,
                    json=payload,
                    timeout=15
                )

                if r.status_code != 200:
                    continue

                data = r.json()

                if isinstance(data, list):
                    for t in data:
                        if t.get("id") == ticket_id:
                            print("\n📋 DETAILS COMPLETS")
                            print("---------------------------------")

                            fields = extract_ocean_fields(t)

                            print("Numéro ticket        :", fields["ticket_id"])
                            print("Numéro ligne         :", fields["msisdn"])
                            print("Téléphone client     :", fields["phone"])
                            print("Identifiant N°1      :", fields["client_id"])
                            print("Adresse client       :", fields["address"])
                            print("Date d’affectation  :", fields["ack_date"])
                            print("Gouvernorat          :", fields["governorate"])
                            print("Technicien resp      :", fields["technician"])
                            print("EDS                  :", eds, "-", EDS_MAP.get(eds, "N/A"))
                            return

            except:
                continue

    print("❌ Ticket non trouvé dans vos EDS")

def extract_ocean_fields(ticket):

    result = {
        "ticket_id": ticket.get("id"),
        "msisdn": None,
        "client_id": None,
        "phone": None,
        "address": None,
        "ack_date": None,
        "governorate": None,
        "technician": None
    }

    # MSISDN + Gouvernorat
    for c in ticket.get("troubleTicketCharacteristic", []):
        if c.get("id") == "MSISDN":
            result["msisdn"] = c.get("value")
        elif c.get("id") == "OTN_Gouvernorat":
            result["governorate"] = c.get("value")

    svc = ticket.get("relatedService", {})

    # ID client
    for s in svc.get("serviceSpecCharacteristic", []):
        if s.get("id") == "IDT1OTU":
            result["client_id"] = s.get("value")

    # Adresse
    for s in svc.get("serviceCharacteristic", []):
        if "adresse" in s.get("name", "").lower():
            result["address"] = s.get("value")

    # 🔹 📞 Téléphone client (robuste)
            for res in svc.get("supportingResource", []):
                for rp in res.get("relatedParty", []):
                    for cm in rp.get("contactMedium", []):

                        if cm.get("type") == "TelephoneNumber":
                            number = cm.get("medium", {}).get("number")

                            if number:
                                result["phone"] = number
                                break

    # 📅 Date acquittement = DERNIER Accepted
    accepted = [
        p.get("currentStatusDate")
        for p in ticket.get("partyIntervention", [])
        if p.get("currentStatus") == "Accepted"
    ]
    if accepted:
        result["ack_date"] = sorted(accepted)[-1]

    # 👨‍🔧 Technicien = dernier contributor humain
    latest = None
    for p in ticket.get("partyIntervention", []):
        d = p.get("currentStatusDate")
        if d and (latest is None or d > latest.get("currentStatusDate")):
            latest = p

    if latest:
        for rp in latest.get("relatedParty", []):
            if rp.get("role") == "TroubleResolutionContributor" and rp.get("@referredType") == "Individual":
                result["technician"] = rp.get("familyName")

    return result

    
EDS_MAP = {
    "595087": "Equipe Nord",
    "595088": "Equipe Centre",
    "595089": "Equipe Sud",
    "595090": "Equipe Cap-Bon"
}

# ================================
# 🔹 MENU
# ================================

if __name__ == "__main__":

    while True:
        print("\n==============================")
        print("1. Backlog utilisateur")
        print("2. Recherche ticket (EDS)")
        print("0. Quitter")
        print("==============================")

        choix = input("Choix: ")

        if choix == "1":
            cuid = input("CUID: ")
            search_tickets_by_user(cuid)

        elif choix == "2":
            cuid = input("CUID: ")
            ticket = input("Numero ticket: ")
            find_ticket_local(ticket, cuid)

        elif choix == "0":
            break

        else:
            print("Choix invalide")