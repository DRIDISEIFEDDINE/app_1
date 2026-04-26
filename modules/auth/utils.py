from werkzeug.security import generate_password_hash, check_password_hash

def generate_password(email):
    username = email.split("@")[0].split(".")[0]
    return f"{username}-MS@2026"

def hash_password(password):
    return generate_password_hash(password)

def verify_password(hash_pw, password):
    return check_password_hash(hash_pw, password)