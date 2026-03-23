from __future__ import annotations

import io
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Dict, List, Optional

import pandas as pd
from flask import Blueprint, Response, current_app, jsonify, render_template, request, send_file

bp = Blueprint(
    "backlog_technicien",
    __name__,
    template_folder="../templates",
    static_folder="../static",
    static_url_path="/backlog_technicien_static",
)

TEAM_TECHNICIANS: Dict[str, List[str]] = {
    "Non renseigné": ["Non renseigné"],
    "Equipe Cap-Bon": ["Galbi Mohamed Achraf", "Kefifi Bessem"],
    "Equipe Centre": ["Slimene Bilel", "Khmiss Yassine", "Ouechtati Issam"],
    "Equipe Nord": [
        "Mimouni Belgacem",
        "Mazgou Mohamed",
        "Jouini Mohamed",
        "Mejri Jihed",
        "Boubaker Wssem",
        "Abdessattar Hamdi",
        "rabie Jrad",
    ],
    "Equipe Sud": [
        "Eddinejabou Issam",
        "Ayoub Issam Eddine",
        "mohamed yengui",
        "Aoun Amine",
    ],
}

TEAM_BY_TECHNICIAN: Dict[str, str] = {
    tech: team for team, technicians in TEAM_TECHNICIANS.items() for tech in technicians
}

DISPLAY_COLUMNS = [
    "Numéro ticket",
    "Champ complémentaire 3",
    "Produit",
    "Date Affectation",
    "Adresse correspondant 1",
    "Nom correspondant 1",
    "Site client correspondant 1",
    "Gouvernorat",
    "Equipe",
    "Technicien",
    "Age Affectation",
    "Etat WF TT",
    "Date Réc",
    "Mobile correspondant 1",
    "Date de création",
]

CANONICAL_ALIASES = {
    "Numéro ticket": ["numéro ticket", "numero ticket", "ticket", "n° ticket", "n ticket"],
    "Champ complémentaire 3": ["champ complémentaire 3", "champ complementaire 3", "complementaire 3"],
    "Produit": ["produit", "product"],
    "Date Affectation": ["date affectation", "affecté depuis", "date daffectation", "affectation"],
    "Adresse correspondant 1": ["adresse correspondant 1", "adresse"],
    "Nom correspondant 1": ["nom correspondant 1", "nom"],
    "Site client correspondant 1": ["site client correspondant 1", "site client"],
    "Gouvernorat": ["gouvernorat", "gov"],
    "Technicien": ["technicien", "responsable", "nom utilisateur", "nomutilisateur", "utilisateur"],
    "Equipe": ["equipe", "équipe", "eds", "team"],
    "Age Affectation": ["age affectation", "âge affectation", "age"],
    "Etat WF TT": ["etat wf tt", "état wf tt", "wf tt"],
    "Date Réc": ["date réc", "date rec", "date réclamation", "date reclamation"],
    "Mobile correspondant 1": ["mobile correspondant 1", "mobile", "n° téléphone", "numero telephone"],
    "Date de création": ["date de création", "date de creation", "date creation", "creation"],
}

DATE_COLUMNS = ["Date Affectation", "Date Réc", "Date de création"]


@dataclass
class LoadResult:
    df: pd.DataFrame
    source_path: Optional[str]


def _norm(value: object) -> str:
    if value is None:
        return ""
    text = str(value).strip()
    return " ".join(text.lower().replace("_", " ").replace("-", " ").split())


def _first_existing_directory() -> Optional[Path]:
    cwd = Path(current_app.root_path).resolve()
    candidates = [
        cwd / "outputs",
        cwd / "uploads",
        cwd.parent / "outputs",
        cwd.parent / "uploads",
        Path.cwd() / "outputs",
        Path.cwd() / "uploads",
    ]
    for candidate in candidates:
        if candidate.exists() and candidate.is_dir():
            return candidate
    return None


def _find_latest_excel() -> Optional[Path]:
    search_roots = []
    direct = _first_existing_directory()
    if direct:
        search_roots.append(direct)

    root = Path(current_app.root_path).resolve()
    search_roots.extend([root, root.parent, Path.cwd()])

    patterns = [
        "BacklogMS*.xlsx",
        "BacklogMS*.xls",
        "*Backlog*.xlsx",
        "*Backlog*.xls",
    ]

    found: List[Path] = []
    for base in search_roots:
        if not base.exists():
            continue
        for pattern in patterns:
            found.extend(base.rglob(pattern))

    found = [p for p in found if p.is_file()]
    found.sort(key=lambda p: p.stat().st_mtime, reverse=True)
    return found[0] if found else None


def _compute_age_bucket(value: object) -> str:
    try:
        age = int(float(value))
    except Exception:
        return "Non renseigné"

    if age <= 5:
        return "0-5 j"
    if age <= 10:
        return "6-10 j"
    if age <= 15:
        return "11-15 j"
    if age <= 20:
        return "16-20 j"
    return "> 20 j"


def _collapse_duplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Fusionne les colonnes portant exactement le même nom en gardant
    la première valeur non vide par ligne.
    """
    result = pd.DataFrame(index=df.index)

    for col_name in pd.unique(df.columns):
        same = df.loc[:, df.columns == col_name]

        if same.shape[1] == 1:
            result[col_name] = same.iloc[:, 0]
            continue

        merged = same.iloc[:, 0].copy()
        for i in range(1, same.shape[1]):
            candidate = same.iloc[:, i]
            merged = merged.where(
                merged.fillna("").astype(str).str.strip() != "",
                candidate
            )
        result[col_name] = merged

    return result


def _rename_and_deduplicate_columns(df: pd.DataFrame) -> pd.DataFrame:
    """
    Renomme les alias vers les noms canoniques, puis fusionne
    les doublons créés par le renommage.
    """
    rename_map = {}

    alias_lookup = {}
    for canonical, aliases in CANONICAL_ALIASES.items():
        alias_lookup[_norm(canonical)] = canonical
        for alias in aliases:
            alias_lookup[_norm(alias)] = canonical

    for col in df.columns:
        normalized = _norm(col)
        rename_map[col] = alias_lookup.get(normalized, str(col).strip())

    renamed = df.rename(columns=rename_map)
    renamed = _collapse_duplicate_columns(renamed)
    return renamed


def _series_from_column(df: pd.DataFrame, col: str) -> pd.Series:
    if col not in df.columns:
        return pd.Series([""] * len(df), index=df.index, dtype=object)

    data = df[col]

    # si malgré tout pandas retourne un DataFrame, on refusionne
    if isinstance(data, pd.DataFrame):
        merged = data.iloc[:, 0].copy()
        for i in range(1, data.shape[1]):
            candidate = data.iloc[:, i]
            merged = merged.where(
                merged.fillna("").astype(str).str.strip() != "",
                candidate
            )
        return merged

    return data


def _safe_to_datetime(series: pd.Series) -> pd.Series:
    clean = series.copy()
    clean = clean.fillna("").astype(str).str.strip()
    clean = clean.replace({"nan": "", "NaT": "", "None": ""})
    return pd.to_datetime(clean, errors="coerce", dayfirst=True)


def _prepare_dataframe(raw_df: pd.DataFrame) -> pd.DataFrame:
    df = raw_df.copy()
    df.columns = [str(c).strip() for c in df.columns]
    df = _rename_and_deduplicate_columns(df)

    for col in DISPLAY_COLUMNS:
        if col not in df.columns:
            df[col] = ""

    tech_series = _series_from_column(df, "Technicien").fillna("").astype(str).str.strip()
    tech_series = tech_series.replace("", "Non renseigné")
    df["Technicien"] = tech_series

    equipe_series = _series_from_column(df, "Equipe").fillna("").astype(str).str.strip()
    equipe_series = equipe_series.where(equipe_series != "", tech_series.map(TEAM_BY_TECHNICIAN))
    equipe_series = equipe_series.fillna("").replace("", "Non renseigné")
    df["Equipe"] = equipe_series

    for col in DATE_COLUMNS:
        base_series = _series_from_column(df, col)
        dt = _safe_to_datetime(base_series)
        df[col] = dt.dt.strftime("%d/%m/%Y").fillna("")

    age_series = pd.to_numeric(_series_from_column(df, "Age Affectation"), errors="coerce").fillna(0)
    df["Age Affectation"] = age_series.astype(int)

    for col in DISPLAY_COLUMNS:
        if col == "Age Affectation":
            continue
        df[col] = _series_from_column(df, col).fillna("").astype(str)

    df["Age Bucket"] = df["Age Affectation"].apply(_compute_age_bucket)

    return df[DISPLAY_COLUMNS + ["Age Bucket"]].copy()


def load_backlog_dataframe() -> LoadResult:
    shared_df = current_app.config.get("BACKLOGMS_SHARED_DF")
    if isinstance(shared_df, pd.DataFrame) and not shared_df.empty:
        return LoadResult(
            df=_prepare_dataframe(shared_df),
            source_path="app.config[BACKLOGMS_SHARED_DF]",
        )

    shared_loader = current_app.config.get("BACKLOGMS_SHARED_LOADER")
    if callable(shared_loader):
        try:
            maybe_df = shared_loader()
            if isinstance(maybe_df, pd.DataFrame) and not maybe_df.empty:
                return LoadResult(
                    df=_prepare_dataframe(maybe_df),
                    source_path="app.config[BACKLOGMS_SHARED_LOADER]",
                )
        except Exception as e:
            empty_df = pd.DataFrame(columns=DISPLAY_COLUMNS + ["Age Bucket"])
            return LoadResult(df=empty_df, source_path=f"Erreur loader: {e}")

    latest_file = _find_latest_excel()
    if latest_file is None:
        empty_df = pd.DataFrame(columns=DISPLAY_COLUMNS + ["Age Bucket"])
        return LoadResult(df=empty_df, source_path=None)

    suffix = latest_file.suffix.lower()
    if suffix == ".xlsx":
        raw_df = pd.read_excel(latest_file, engine="openpyxl")
    else:
        raw_df = pd.read_excel(latest_file)

    return LoadResult(df=_prepare_dataframe(raw_df), source_path=str(latest_file))


def _apply_filters(df: pd.DataFrame, equipe: str = "", technicien: str = "", search: str = "") -> pd.DataFrame:
    filtered = df.copy()

    if equipe and equipe != "TOUS":
        filtered = filtered[
            filtered["Equipe"].fillna("").astype(str).str.strip().str.casefold() == equipe.strip().casefold()
        ]

    if technicien and technicien != "TOUS":
        filtered = filtered[
            filtered["Technicien"].fillna("").astype(str).str.strip().str.casefold() == technicien.strip().casefold()
        ]

    if search:
        keyword = search.strip().lower()
        if keyword:
            mask = filtered.astype(str).apply(
                lambda col: col.str.lower().str.contains(keyword, na=False)
            )
            filtered = filtered[mask.any(axis=1)]

    return filtered.reset_index(drop=True)


def _build_payload(df: pd.DataFrame):
    tickets_by_product = (
        df.groupby("Produit", dropna=False)
        .size()
        .sort_values(ascending=False)
        .reset_index(name="count")
    )

    age_distribution = (
        df.groupby("Age Bucket", dropna=False)
        .size()
        .reindex(["0-5 j", "6-10 j", "11-15 j", "16-20 j", "> 20 j", "Non renseigné"])
        .fillna(0)
        .astype(int)
        .reset_index(name="count")
        .rename(columns={"index": "bucket"})
    )

    kpis = {
        "total_tickets": int(len(df)),
        "age_moyen": round(float(df["Age Affectation"].mean()), 1) if len(df) else 0,
        "age_max": int(df["Age Affectation"].max()) if len(df) else 0,
        "wf_tt_oui": int(
            df["Etat WF TT"].astype(str).str.strip().str.lower().isin(["oui", "retour fsi"]).sum()
        ) if len(df) else 0,
        "avec_date_rec": int(df["Date Réc"].astype(str).str.strip().ne("").sum()) if len(df) else 0,
    }

    dashboard_team = (
        df.groupby("Equipe", dropna=False)
        .agg(
            total=("Numéro ticket", "size"),
            age_moyen=("Age Affectation", "mean"),
            age_max=("Age Affectation", "max"),
        )
        .reset_index()
        .sort_values(by="total", ascending=False)
    )

    dashboard_team["age_moyen"] = dashboard_team["age_moyen"].fillna(0).round(1)
    dashboard_team["age_max"] = dashboard_team["age_max"].fillna(0).astype(int)

    return {
        "kpis": kpis,
        "tickets_by_product": tickets_by_product.to_dict(orient="records"),
        "age_distribution": age_distribution.to_dict(orient="records"),
        "mini_dashboard_equipe": dashboard_team.to_dict(orient="records"),
        "rows": df.to_dict(orient="records"),
    }


@bp.route("/backlog-technicien")
def backlog_technicien_page():
    return render_template("backlog_technicien_v2.html", teams=TEAM_TECHNICIANS)


@bp.route("/api/backlog-technicien/options")
def backlog_technicien_options() -> Response:
    return jsonify({
        "equipes": [{"name": team, "techniciens": technicians} for team, technicians in TEAM_TECHNICIANS.items()]
    })


@bp.route("/api/backlog-technicien/data")
def backlog_technicien_data() -> Response:
    equipe = request.args.get("equipe", "").strip()
    technicien = request.args.get("technicien", "").strip()
    search = request.args.get("search", "").strip()

    try:
        loaded = load_backlog_dataframe()
        df = _apply_filters(loaded.df, equipe=equipe, technicien=technicien, search=search)
        payload = _build_payload(df)
        payload["source_path"] = loaded.source_path
        payload["selected"] = {"equipe": equipe, "technicien": technicien, "search": search}
        return jsonify(payload)
    except Exception as e:
        return jsonify({
            "kpis": {
                "total_tickets": 0,
                "age_moyen": 0,
                "age_max": 0,
                "wf_tt_oui": 0,
                "avec_date_rec": 0,
            },
            "tickets_by_product": [],
            "age_distribution": [],
            "mini_dashboard_equipe": [],
            "rows": [],
            "source_path": f"Erreur: {e}",
            "selected": {"equipe": equipe, "technicien": technicien, "search": search},
            "error": str(e),
        }), 500


@bp.route("/api/backlog-technicien/export")
def backlog_technicien_export() -> Response:
    equipe = request.args.get("equipe", "").strip()
    technicien = request.args.get("technicien", "").strip()
    search = request.args.get("search", "").strip()

    loaded = load_backlog_dataframe()
    df = _apply_filters(loaded.df, equipe=equipe, technicien=technicien, search=search)

    export_df = df[DISPLAY_COLUMNS].copy()
    now = datetime.now().strftime("%Y-%m-%d_%H-%M-%S")
    filename = f"Backlog_Technicien_{now}.xlsx"

    output = io.BytesIO()
    with pd.ExcelWriter(output, engine="openpyxl") as writer:
        export_df.to_excel(writer, index=False, sheet_name="Backlog Technicien")
        sheet = writer.book["Backlog Technicien"]

        from openpyxl.utils import get_column_letter
        for idx, col in enumerate(export_df.columns, start=1):
            max_len = len(str(col))
            if len(export_df):
                sample_lengths = [len(str(v)) for v in export_df[col].head(500).tolist()]
                max_len = max([max_len] + sample_lengths)
            sheet.column_dimensions[get_column_letter(idx)].width = min(max(max_len + 2, 14), 40)

    output.seek(0)
    return send_file(
        output,
        as_attachment=True,
        download_name=filename,
        mimetype="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )