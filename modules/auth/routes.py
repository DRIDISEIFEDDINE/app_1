from flask import Blueprint, render_template, request, redirect, session, url_for, flash
import json
import re
from pathlib import Path
from werkzeug.security import generate_password_hash, check_password_hash

auth_bp = Blueprint("auth", __name__)

DATA_PATH = Path(__file__).resolve().parents[2] / "data" / "users.json"


# ================= USERS =================
def load_users():
    if DATA_PATH.exists():
        with open(DATA_PATH, "r", encoding="utf-8") as f:
            return json.load(f)
    return {}


def save_users(users):
    DATA_PATH.parent.mkdir(exist_ok=True)
    with open(DATA_PATH, "w", encoding="utf-8") as f:
        json.dump(users, f, indent=2)


# ================= PASSWORD POLICY =================
def valid_password(pw: str) -> bool:
    return (
        len(pw) >= 8 and
        re.search(r"[A-Z]", pw) and
        re.search(r"\d", pw) and
        re.search(r"[^\w\s]", pw)
    )


# ================= LOGIN =================
@auth_bp.route("/", methods=["GET", "POST"])
def login():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()
        password = request.form.get("password", "")

        users = load_users()
        user = users.get(email)

        if user and check_password_hash(user["password"], password):

            # 🔥 FIRST LOGIN
            if user.get("first_login", False):
                session["temp_user"] = email
                return redirect(url_for("auth.change_password"))

            session["user"] = email
            session["role"] = user["role"]

            return redirect(url_for("dashboard"))

        flash("Email ou mot de passe incorrect", "error")

    return render_template("login.html")


# ================= LOGOUT =================
@auth_bp.route("/logout")
def logout():
    session.clear()
    return redirect(url_for("auth.login"))


# ================= CHANGE PASSWORD =================
@auth_bp.route("/change_password", methods=["GET", "POST"])
def change_password():
    email = session.get("temp_user") or session.get("user")

    if not email:
        return redirect(url_for("auth.login"))

    if request.method == "POST":
        if not email:
            email = request.form.get("email", "").strip().lower()

        old_pw = request.form.get("old_password", "")
        new_pw = request.form.get("new_password", "")
        confirm_pw = request.form.get("confirm_password", "")

        users = load_users()
        user = users.get(email)

        if not user:
            flash("Utilisateur introuvable", "error")
            return redirect(url_for("auth.change_password"))

        if not check_password_hash(user["password"], old_pw):
            flash("Ancien mot de passe incorrect", "error")
            return redirect(url_for("auth.change_password"))

        if new_pw != confirm_pw:
            flash("Les mots de passe ne correspondent pas", "error")
            return redirect(url_for("auth.change_password"))

        if not valid_password(new_pw):
            flash("Mot de passe non conforme (Majuscule + chiffre + spécial + ≥8)", "error")
            return redirect(url_for("auth.change_password"))

        # 🔐 update
        users[email]["password"] = generate_password_hash(new_pw)
        users[email]["first_login"] = False

        save_users(users)

        session.pop("temp_user", None)

        flash("Mot de passe modifié avec succès", "success")
        return redirect(url_for("auth.login"))

    return render_template("change_password.html")

# ================= PASSWORD Oublie =================
@auth_bp.route("/forgot_password", methods=["GET", "POST"])
def forgot_password():
    if request.method == "POST":
        email = request.form.get("email", "").strip().lower()

        users = load_users()

        if email in users:
    # futur reset possible
            pass

            flash("Si un compte existe avec cet email, une action a été déclenchée.", "success")
        else:
            # 🔐 pour l’instant simple (offline)
            flash("Demande prise en compte. Contactez l'administrateur.", "success")

        return redirect(url_for("auth.forgot_password"))

    return render_template("forgot_password.html")