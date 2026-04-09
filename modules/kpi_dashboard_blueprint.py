from flask import Blueprint, jsonify, render_template, Response
import pandas as pd
import glob
import os
import json

kpi_bp = Blueprint(
    "kpi_dashboard",
    __name__,
    template_folder="../templates"
)

# ================= TROUVER LE DERNIER FICHIER =================
def get_latest_excel():
    folder = r"C:\xampp\htdocs\app_1\Base de donnees\\"
    files = glob.glob(os.path.join(folder, "Rapport-Intervention-GP-*.xlsx"))

    print("📂 Fichiers trouvés:", files)

    if not files:
        return None

    latest = max(files, key=os.path.getctime)
    print("📄 Fichier utilisé:", latest)

    return latest


# ================= LECTURE EXCEL =================
def load_raw():
    file = get_latest_excel()

    if not file:
        return pd.DataFrame()

    try:
        df = pd.read_excel(file, sheet_name="Etat Réparé")

        print("✅ Colonnes:", list(df.columns))
        print("✅ Nb lignes:", len(df))

        return df

    except Exception as e:
        print("❌ ERREUR lecture Excel:", e)
        return pd.DataFrame()


# ================= DETECTION COLONNE =================
def safe_get(df, keyword):
    for col in df.columns:
        if keyword.lower() in str(col).lower():
            return col
    return None


# ================= TRAITEMENT =================
def process(df):

    if df.empty:
        return df

    # 🔥 éviter NaN
    df = df.fillna("")

    # ===== DETECTION COLONNES =====
    col_ticket = safe_get(df, "ticket")
    col_date = safe_get(df, "réparation")
    col_delai = safe_get(df, "prise en charge")
    col_gouv = safe_get(df, "10 bis")   # ✅ FIX IMPORTANT
    col_prod = safe_get(df, "produit")
    col_tech = safe_get(df, "utilisateur")
    col_eq = safe_get(df, "EDS")

    print("📊 Colonnes détectées:")
    print("ticket:", col_ticket)
    print("date:", col_date)
    print("delai:", col_delai)
    print("gouv:", col_gouv)
    print("produit:", col_prod)
    print("tech:", col_tech)
    print("equipe:", col_eq)

    # ===== DOUBLONS =====
    if col_ticket and col_date:
        df = df.drop_duplicates(subset=[col_ticket, col_date])

    # ===== GOUVERNORAT =====
    def extract_gouv(x):
        x = str(x)
        return x.split("\\")[-1] if "\\" in x else x

    df["Gouvernorat"] = df[col_gouv].apply(extract_gouv) if col_gouv else ""

    # ===== PRODUIT =====
    def extract_prod(x):
        x = str(x).split("_")[0]
        if "VOIP-GPON" in x:
            return "VOIP-GPON"
        return x

    df["Produit"] = df[col_prod].apply(extract_prod) if col_prod else ""

    # ===== DELAI =====
    if col_delai:
        df["Delai"] = pd.to_numeric(df[col_delai], errors="coerce").fillna(0) / 1440
    else:
        df["Delai"] = 0

    # ===== DATE =====
    if col_date:
        df["Date"] = pd.to_datetime(df[col_date], errors="coerce")
    else:
        df["Date"] = pd.Timestamp.now()

    df["Jour"] = df["Date"].dt.strftime("%Y-%m-%d")

    # ===== COLONNES FINALES =====
    df["Technicien"] = df[col_tech] if col_tech else "N/A"
    df["Equipe"] = df[col_eq] if col_eq else "N/A"

    return df


# ================= PAGE =================
@kpi_bp.route("/kpi_dashboard")
def page():
    return render_template("kpi_dashboard.html")


# ================= API =================
@kpi_bp.route("/api/kpi")
def api():
    try:
        print("🚀 KPI API CALL")

        df = load_raw()

        if df.empty:
            return jsonify({"error": "Aucun fichier trouvé"})

        df = process(df)

        if df.empty:
            return jsonify({"error": "Données vides après traitement"})
        # ================= FILTRES =================
        from flask import request

        tech = request.args.get("technicien")
        prod = request.args.get("produit")
        eq = request.args.get("equipe")
        date_start = request.args.get("date_start")
        date_end = request.args.get("date_end")

        # 🔥 appliquer filtres
        if tech:
            tech_list = tech.split(",")
            df = df[df["Technicien"].isin(tech_list)]

        if prod:
            prod_list = prod.split(",")
            df = df[df["Produit"].isin(prod_list)]

        if eq:
            eq_list = eq.split(",")
            df = df[df["Equipe"].isin(eq_list)]

        if date_start and date_end:
            df = df[
                (df["Date"] >= pd.to_datetime(date_start)) &
                (df["Date"] <= pd.to_datetime(date_end))
        ]

        # 🔥 sécurité finale
        df["Delai"] = pd.to_numeric(df["Delai"], errors="coerce").fillna(0)

        # ===== KPI =====
        kpi_tech = df.groupby(["Jour", "Technicien"]).size().reset_index(name="Volume")
        kpi_prod = df.groupby(["Jour", "Produit"]).size().reset_index(name="Volume")
        kpi_eq = df.groupby(["Jour", "Equipe"]).size().reset_index(name="Volume")

        result = {
            "tech": kpi_tech.to_dict(orient="records"),
            "prod": kpi_prod.to_dict(orient="records"),
            "eq": kpi_eq.to_dict(orient="records"),
            "global": round(float(df["Delai"].mean()), 2),
            "total": int(len(df))
        }

        print("✅ KPI OK")

        return Response(
            json.dumps(result, ensure_ascii=False),
            content_type="application/json"
        )

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)})