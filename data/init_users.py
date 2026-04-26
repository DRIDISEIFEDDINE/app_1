from werkzeug.security import generate_password_hash
import json
from pathlib import Path

DATA_PATH = Path(__file__).resolve().parent / "users.json"

users = {}

tech_users = [
    "mohamedachraf.galbi@orange.com",
    "mohamed.mazgou@orange.com",
    "belgacem.mimouni@orange.com",
    "issam.eddinejabou@orange.com",
    "issam.ouechtati@orange.com",
    "wissem.boubaker@orange.com",
    "bilel.slimene@orange.com",
    "amine.aoun@orange.com",
    "rabie.jrad@orange.com",
    "bessem.kefifi@orange.com",
    "mohamed.jouini@orange.com",
    "yassine.khmiss@orange.com",
    "jihed.mejri@orange.com",
    "issam.ayoub@orange.com",
    "mohamed.yangui@orange.com",
    "abdessttar.hamdi@orange.com"
]

admin_users = [
    "seifeddine.dridi@orange.com"
]

# ===== TECH =====
for email in tech_users:
    username = email.split("@")[0].split(".")[0]
    password = f"{username}-MS@2026"

    users[email] = {
        "password": generate_password_hash(password),
        "role": "technicien",
        "first_login": True
    }

# ===== ADMIN =====
for email in admin_users:
    username = email.split("@")[0].split(".")[0]
    password = f"{username}-MS@2026"

    users[email] = {
        "password": generate_password_hash(password),
        "role": "admin",
        "first_login": True
    }

with open(DATA_PATH, "w", encoding="utf-8") as f:
    json.dump(users, f, indent=2)

print("✅ users.json généré :", DATA_PATH)