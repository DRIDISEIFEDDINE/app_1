import requests
from .auth import get_token

BASE_URL = "http://10.27.66.66:38444"


def call_api(endpoint, params=None):
    token = get_token()

    headers = {
        "Authorization": f"Bearer {token}",
        "Accept": "application/json"
    }

    url = f"{BASE_URL}{endpoint}"

    res = requests.get(url, headers=headers, params=params)

    if res.status_code != 200:
        raise Exception(f"OCEAN Error: {res.text}")

    return res.json()


def get_ticket(ticket_id):
    return call_api("/ocean/getTicket", {
        "ticketid": ticket_id,
        "username": "mfrikha",
        "cuid": "QXWG6583"
    })


def search_by_msisdn(msisdn):
    return call_api("/ocean/getvarTicket", {
        "MSISDN": msisdn,
        "username": "mfrikha",
        "cuid": "QXWG6583"
    })