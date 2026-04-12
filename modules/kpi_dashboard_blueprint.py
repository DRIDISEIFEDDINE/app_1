from flask import Blueprint, jsonify, render_template, request
import pandas as pd
import glob
import os

kpi_bp = Blueprint(
    "kpi_dashboard",
    __name__,
    template_folder="../templates"
)

# ================= CONFIG =================
DATA_FOLDER = r"C:\xampp\htdocs\app_1\Base de donnees\\"

# 🔥 mapping métier FIXE
TECH_EQUIPE_MAP = {
    "Abdessattar Hamdi": "OTU_DRS_Intervention_Nord",
    "Aoun Amine": "OTU_DRS_Intervention_Sud",
    "Ayoub Issam Eddine": "OTU_DRS_Intervention_Sud",
    "Boubaker Wssem": "OTU_DRS_Intervention_Nord",
    "Eddinejabou Issam": "OTU_DRS_Intervention_Sud",
    "Galbi Mohamed Achraf": "OTU_DRS_Intervention_Cap_Bon",
    "Jouini Mohamed": "OTU_DRS_Intervention_Nord",
    "Kefifi Bessem": "OTU_DRS_Intervention_Cap_Bon",
    "Khmiss Yassine": "OTU_DRS_Intervention_Centre",
    "Mazgou Mohamed": "OTU_DRS_Intervention_Nord",
    "Mejri Jihed": "OTU_DRS_Intervention_Nord",
    "Mimouni Belgacem": "OTU_DRS_Intervention_Nord",
    "mohamed yengui": "OTU_DRS_Intervention_Sud",
    "Ouechtati Issam": "OTU_DRS_Intervention_Centre",
    "rabie Jrad": "OTU_DRS_Intervention_Nord",
    "Slimene Bilel": "OTU_DRS_Intervention_Centre"
}

# ================= TROUVER LE DERNIER FICHIER =================
def get_latest_excel():
    files = glob.glob(os.path.join(DATA_FOLDER, "Rapport-Intervention-GP-*.xlsx"))

    if not files:
        print("❌ Aucun fichier trouvé")
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

    df = df.fillna("")

    col_ticket = safe_get(df, "ticket")
    col_date = safe_get(df, "réparation")
    col_delai = safe_get(df, "prise en charge")
    col_gouv = safe_get(df, "10 bis")
    col_prod = safe_get(df, "produit")
    col_tech = safe_get(df, "utilisateur")

    # ===== DOUBLONS =====
    if col_ticket and col_date:
        df = df.drop_duplicates(subset=[col_ticket, col_date])

    # ===== GOUVERNORAT =====
    if col_gouv:
        df["Gouvernorat"] = df[col_gouv].astype(str).apply(
            lambda x: x.split("\\")[-1] if "\\" in x else x
        )
    else:
        df["Gouvernorat"] = ""

    # ===== PRODUIT =====
    if col_prod:
        df["Produit"] = df[col_prod].astype(str).apply(
            lambda x: "VOIP-GPON" if "VOIP-GPON" in x else x.split("_")[0]
        )
    else:
        df["Produit"] = ""

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

    # ===== TECH + EQUIPE (FIX IMPORTANT) =====
    df["Technicien"] = df[col_tech] if col_tech else "N/A"
    df["Equipe"] = df["Technicien"].map(TECH_EQUIPE_MAP).fillna("N/A")

    return df


# ================= PAGE =================
@kpi_bp.route("/kpi_dashboard")
def page():
    return render_template("kpi_dashboard.html")


# ================= API KPI =================
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
        
        tech_list = request.args.getlist("technicien")
        prod_list = request.args.getlist("produit")
        eq_list = request.args.getlist("equipe")

        date_start = request.args.get("date_start")
        date_end = request.args.get("date_end")

# 🔥 initialisation (évite crash)
        eq_from_tech = []
        tech_from_eq = []

# ================= CAS 1 : TECH =================
        if tech_list:

            df = df[df["Technicien"].isin(tech_list)]

            eq_from_tech = [
            TECH_EQUIPE_MAP.get(t)
            for t in tech_list
            if t in TECH_EQUIPE_MAP
        ]

        if eq_from_tech:
            df = df[df["Equipe"].isin(eq_from_tech)]

# ================= CAS 2 : EQUIPE =================
        elif eq_list:

            df = df[df["Equipe"].isin(eq_list)]

            tech_from_eq = [
                t for t, eq in TECH_EQUIPE_MAP.items()
                if eq in eq_list
            ]

        if tech_from_eq:
            df = df[df["Technicien"].isin(tech_from_eq)]

# ================= PRODUIT =================
        if prod_list:
            df = df[df["Produit"].isin(prod_list)]

# ================= DATES =================
        if date_start and date_end:
            df = df[
            (df["Date"] >= pd.to_datetime(date_start)) &
            (df["Date"] <= pd.to_datetime(date_end))
        ]
        # ===== DEBUG =====
        print("📊 Après filtres:", len(df))

        # ===== KPI =====
        df["Delai"] = pd.to_numeric(df["Delai"], errors="coerce").fillna(0)

        kpi_tech = df.groupby(["Jour", "Technicien"]).agg(
        Volume=("Technicien", "size"),
        Delai=("Delai", "mean")
        ).reset_index()

        kpi_prod = df.groupby(["Jour", "Produit"]).agg(
        Volume=("Produit", "size"),
        Delai=("Delai", "mean")
        ).reset_index()
        
        kpi_eq = df.groupby(["Jour", "Equipe"]).agg(
        Volume=("Equipe", "size"),
        Delai=("Delai", "mean")
        ).reset_index()

        result = {
            "tech": kpi_tech.to_dict(orient="records"),
            "prod": kpi_prod.to_dict(orient="records"),
            "eq": kpi_eq.to_dict(orient="records"),
            "global": round(float(df["Delai"].mean()), 2),
            "total": int(len(df))
        }

        print("✅ KPI OK")

        return jsonify(result)

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)})


# ================= API FILTERS =================
@kpi_bp.route("/api/filters")
def get_filters():
    try:
        df = load_raw()
        df = process(df)

        equipes = sorted(set(TECH_EQUIPE_MAP.values()))
        techniciens = sorted(TECH_EQUIPE_MAP.keys())

        mapping = [
            {"Technicien": t, "Equipe": eq}
            for t, eq in TECH_EQUIPE_MAP.items()
        ]

        produits = []
        if not df.empty:
            produits = sorted(
                p for p in df["Produit"].astype(str).unique()
                if p and p != "nan"
            )

        return jsonify({
            "equipes": equipes,
            "techniciens": techniciens,
            "produits": produits,
            "mapping": mapping
        })

    except Exception as e:
        import traceback
        traceback.print_exc()
        return jsonify({"error": str(e)})