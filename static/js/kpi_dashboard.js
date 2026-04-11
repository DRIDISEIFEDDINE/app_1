let currentView = null;
let techByEquipe = {};
let filtersLoaded = false;

// ================= VIEW =================
function showView(view) {

    currentView = view;

    document.getElementById("kpiContent").classList.remove("hidden");

    const filters = document.getElementById("filtersPanel");
    if (filters) filters.classList.remove("hidden");

    hideAllCharts();

    if (view === "tech") showChart("chartTech");
    if (view === "equipe") showChart("chartEquipe");
    if (view === "produit") showChart("chartProduit");

    loadData();
}

// ================= RESET =================
function resetView() {

    currentView = null;

    document.getElementById("kpiContent").classList.add("hidden");

    const filters = document.getElementById("filtersPanel");
    if (filters) filters.classList.add("hidden");

    filtersLoaded = false;
}

// ================= LOAD DATA =================
async function loadData() {

    const loader = document.getElementById("loader");

    try {
        if (loader) loader.classList.remove("hidden");

        const params = new URLSearchParams({
            technicien: getChecked("technicien"),
            produit: getChecked("produit"),
            equipe: getChecked("equipe"),
            date_start: document.getElementById("dateStart")?.value || "",
            date_end: document.getElementById("dateEnd")?.value || ""
        });

        const res = await fetch("/api/kpi?" + params.toString());

        const data = await res.json();

        if (data.error) {
            console.error(data.error);
            alert(data.error);
            return;
        }

        console.log("KPI DATA:", data);

        // 🔥 charger filtres une seule fois
        if (!filtersLoaded) {
            await loadFilters();
            filtersLoaded = true;
        }

        // ===== KPI =====
        if (currentView === "tech" && Array.isArray(data.tech)) {
    drawChart("chartTech", data.tech, "Technicien");
}

if (currentView === "equipe" && Array.isArray(data.eq)) {
    drawChart("chartEquipe", data.eq, "Equipe");
}

if (currentView === "produit" && Array.isArray(data.prod)) {
    drawChart("chartProduit", data.prod, "Produit");
}

        if (data.global !== undefined) {
    drawGauge(Number(data.global));
}

        // KPI résumé
        document.getElementById("kpiTotal").innerText =
            `${data.total} interventions`;

    } catch (err) {
        console.error("JS ERROR:", err);
        alert("Erreur chargement KPI");
    } finally {
        if (loader) loader.classList.add("hidden");
    }
}

// ================= LOAD FILTERS =================
async function loadFilters() {

    try {
        const res = await fetch("/api/filters");
        const data = await res.json();

        if (data.error) {
            console.error(data.error);
            return;
        }

        console.log("FILTER DATA:", data);

        populateFilters(data);

    } catch (e) {
        console.error("Erreur filters:", e);
    }
}

// ================= BUILD MAPPING =================
function buildMapping(data) {

    techByEquipe = {};

    data.mapping.forEach(row => {

        const eq = row.Equipe;
        const tech = row.Technicien;

        if (!techByEquipe[eq]) {
            techByEquipe[eq] = new Set();
        }

        techByEquipe[eq].add(tech);
    });
}

// ================= POPULATE FILTERS =================
function populateFilters(data) {

    buildMapping(data);

    createCheckboxFilter("filterEquipe", data.equipes, "equipe");
    createCheckboxFilter("filterProduit", data.produits, "produit");
    createCheckboxFilter("filterTechnicien", data.techniciens, "technicien");

    attachEquipeFilter();
}

// ================= FILTRE ÉQUIPE → TECH =================
function attachEquipeFilter() {

    document.querySelectorAll("input[name='equipe']").forEach(cb => {

        cb.addEventListener("change", () => {

            const selected = getChecked("equipe").split(",").filter(x => x);

            let techs = new Set();

            if (selected.length === 0) {
                Object.values(techByEquipe).forEach(set => {
                    set.forEach(t => techs.add(t));
                });
            } else {
                selected.forEach(eq => {
                    if (techByEquipe[eq]) {
                        techByEquipe[eq].forEach(t => techs.add(t));
                    }
                });
            }

            createCheckboxFilter("filterTechnicien", [...techs], "technicien");
        });

    });
}

// ================= CHECKBOX BUILDER =================
function createCheckboxFilter(containerId, values, name) {

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    values.forEach(v => {

        if (!v) return;

        const div = document.createElement("div");
        div.className = "filter-item";

        div.innerHTML = `
            <label>
                <input type="checkbox" name="${name}" value="${v}">
                ${v}
            </label>
        `;

        container.appendChild(div);
    });
}

// ================= GET CHECKED =================
function getChecked(name) {
    return Array.from(document.querySelectorAll(`input[name="${name}"]:checked`))
        .map(el => el.value)
        .join(",");
}

// ================= GAUGE =================
function drawGauge(value) {

    const el = document.getElementById("gaugeChart");
    if (!el) return;

    // 🔥 IMPORTANT : éviter superposition
    let chart = echarts.getInstanceByDom(el);

    if (chart) {
        chart.dispose(); // supprime ancien
    }

    chart = echarts.init(el);

    chart.setOption({
        series: [{
            type: 'gauge',
            min: 0,
            max: 10,

            axisLine: {
                lineStyle: {
                    width: 15,
                    color: [
                        [0.4, '#16a34a'],   // vert
                        [0.6, '#f59e0b'],   // orange
                        [1, '#dc2626']      // rouge
                    ]
                }
            },

            pointer: {
                width: 5
            },

            detail: {
                formatter: function (val) {
                    return val.toFixed(2) + " j";
                },
                fontSize: 18,
                offsetCenter: [0, "60%"]
            },

            data: [{ value: value || 0 }]
        }]
    });
}

// ================= CHART HELPERS =================
function hideAllCharts() {
    ["chartTech", "chartEquipe", "chartProduit"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.parentElement.style.display = "none";
    });
}

function showChart(id) {
    const el = document.getElementById(id);
    if (el) el.parentElement.style.display = "block";
}

function drawChart(id, dataset, field) {

    if (!dataset || dataset.length === 0) {
        console.warn("Dataset vide pour", id);
        return;
    }

    const ctx = document.getElementById(id);
    if (!ctx) return;

    if (ctx.chart) ctx.chart.destroy();

    const labels = [...new Set(dataset.map(d => d.Jour))].sort();

    const grouped = {};

    dataset.forEach(d => {
        const key = d[field] || "N/A";
        if (!grouped[key]) grouped[key] = {};
        grouped[key][d.Jour] = d.Volume;
    });

    const datasets = Object.keys(grouped).map(k => ({
        label: k,
        data: labels.map(m => grouped[k][m] || 0),
        borderWidth: 2,
        fill: false,
        tension: 0.3
    }));

    ctx.chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets }
    });
}

// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {

    console.log("✅ KPI Dashboard Ready");

    // 🔥 précharger filtres
    loadFilters();
});