import os
import json
import time
import base64
import requests

TOKEN_FILE = r"C:\xampp\htdocs\app_1\TEMP\oauth_token.txt"
CONFIG_FILE = r"C:\xampp\htdocs\app_1\config\oauth.txt"

TOKEN_URL = "https://afi-obs.apibackbone.api.intraorange/oauth/v3/token"


def load_credentials():
    creds = {}
    with open(CONFIG_FILE) as f:
        for line in f:
            key, value = line.strip().split("=")
            creds[key] = value
    return creds


def get_token():
    if os.path.exists(TOKEN_FILE):
        data = json.load(open(TOKEN_FILE))
        if time.time() < data["expires_at"]:
            return data["access_token"]

    return refresh_token()


def refresh_token():
    creds = load_credentials()

    credentials = f"{creds['client_id']}:{creds['client_secret']}"
    encoded = base64.b64encode(credentials.encode()).decode()

    headers = {
        "Authorization": f"Basic {encoded}",
        "Content-Type": "application/x-www-form-urlencoded"
    }

    payload = {
        "grant_type": "client_credentials"
    }

    res = requests.post(TOKEN_URL, headers=headers, data=payload)

    if res.status_code != 200:
        raise Exception(f"OAuth Error: {res.text}")

    data = res.json()

    json.dump({
        "access_token": data["access_token"],
        "expires_at": time.time() + data.get("expires_in", 3600) - 60
    }, open(TOKEN_FILE, "w"))

    return data["access_token"]