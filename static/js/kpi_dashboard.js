let currentView = null;
let techByEquipe = {};
let filtersLoaded = false;

// ================= VIEW =================
function showView(view) {

    currentView = view;

    const content = document.getElementById("kpiContent");
    if (content) content.classList.remove("hidden");

    // 🔥 afficher filtres uniquement ici
    const filters = document.getElementById("filtersPanel");
    if (filters) filters.classList.remove("hidden");

    hideAllCharts();

    if (view === "tech") showChart("chartTech");
    if (view === "equipe") showChart("chartEquipe");
    if (view === "produit") showChart("chartProduit");
    if (view === "tech_perf") {document.getElementById("gaugeChart").style.display = "none";}

    // 🔥 charger filtres UNE SEULE FOIS
    if (!filtersLoaded) {
        loadFilters().then(() => {
            filtersLoaded = true;
            loadData(); // charger après filtres
        });
    } else {
        loadData();
    }
}

// ================= RESET =================
function resetView() {

    currentView = null;

    const content = document.getElementById("kpiContent");
    if (content) content.classList.add("hidden");

    const filters = document.getElementById("filtersPanel");
    if (filters) filters.classList.add("hidden");

    filtersLoaded = false;
}
// ================= LOAD DATA =================
async function loadData() {

    const loader = document.getElementById("loader");

    try {
        if (loader) loader.classList.remove("hidden");

        const params = new URLSearchParams();

        // 🔥 MULTI VALUES
        getChecked("technicien").split(",").forEach(v => {
            if (v) params.append("technicien", v);
        });

        getChecked("produit").split(",").forEach(v => {
            if (v) params.append("produit", v);
        });

        getChecked("equipe").split(",").forEach(v => {
            if (v) params.append("equipe", v);
        });

        // 🔥 dates
        params.append("date_start", document.getElementById("dateStart")?.value || "");
        params.append("date_end", document.getElementById("dateEnd")?.value || "");

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

        // ================= PERFORMANCE TECH =================
        if (currentView === "tech_perf" && Array.isArray(data.tech)) {

            const selectedTechs = getChecked("technicien").split(",").filter(x => x);

            const container = document.getElementById("multiGaugeContainer");
            const chartEl = document.getElementById("chartTech");
            const mainGauge = document.getElementById("gaugeChart");

            if (chartEl) chartEl.style.display = "none";
            if (mainGauge) mainGauge.style.display = "none";

            if (container) container.innerHTML = "";

            drawMultiGaugesTechOnly(data.tech, selectedTechs);
        }

        // ================= KPI TECH =================
else if (currentView === "tech" && Array.isArray(data.tech)) {

    const chartEl = document.getElementById("chartTech");
    const container = document.getElementById("multiGaugeContainer");
    const mainGauge = document.getElementById("gaugeChart");

    // 🔥 reset
    if (container) container.innerHTML = "";
    if (chartEl) chartEl.style.display = "block";
    if (mainGauge) mainGauge.style.display = "block";

    // 🔥 afficher histogramme (UNE SEULE FOIS)
    toggleHistogram(true);
    setHistogramTitle("Technicien - Volume des tickets");
    
    drawChart("chartTech", data.tech, "Technicien");
    drawTechHistogram(data.tech);
    drawGauge(Number(data.global));
}

// ================= KPI EQUIPE =================
else if (currentView === "equipe" && Array.isArray(data.eq)) {

    // 🔥 afficher histogramme
    toggleHistogram(true);

    // 🔥 changer le titre ICI
    setHistogramTitle("Équipe - Volume des tickets");
    

    const selectedEquipes = getChecked("equipe").split(",").filter(x => x);

    // 🔥 histogramme équipe
    drawEquipeHistogram(data.eq);

    if (selectedEquipes.length > 1) {
        document.getElementById("gaugeChart").style.display = "none";
        drawMultiGauges(data.eq);
    } else {
        document.getElementById("multiGaugeContainer").innerHTML = "";
        document.getElementById("gaugeChart").style.display = "block";
        drawChart("chartEquipe", data.eq, "Equipe");
    }
}
// ================= KPI PRODUIT =================
else if (currentView === "produit" && Array.isArray(data.prod)) {

    toggleHistogram(true); // 🔥 ON AFFICHE

    // 🔥 TITRE DYNAMIQUE
    setHistogramTitle("Produit - Volume des tickets");
    

    const container = document.getElementById("multiGaugeContainer");
    if (container) container.innerHTML = "";

    // 🔥 HISTOGRAMME PRODUIT
    drawProduitHistogram(data.prod);

    // 🔥 COURBE PRODUIT
    drawChart("chartProduit", data.prod, "Produit");
}
        // ================= KPI GLOBAL =================
        if (data.global !== undefined && currentView !== "tech_perf") {
            drawGauge(Number(data.global));
            toggleHistogram(false);
        }

        // ================= KPI SUMMARY =================
        document.getElementById("kpiTotal").innerHTML = `
            <span style="font-size:28px;font-weight:bold;">
                ${data.total.toLocaleString()}
            </span>
            <br>
            <span style="color:gray;font-size:14px;">
                interventions
            </span>
        `;

        document.getElementById("kpiLabel").innerHTML = `
            Délai moyen : <b>${data.global} j</b>
        `;

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

        // 🔥 IMPORTANT : sync initial
        syncTechWithEquipe(data.mapping);

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

    attachEquipeFilter(data.mapping);
}


// ================= FILTRE ÉQUIPE → TECH =================
function attachEquipeFilter(mapping) {

    document.querySelectorAll("input[name='equipe']").forEach(cb => {

        cb.addEventListener("change", () => {

            const selected = getChecked("equipe").split(",").filter(x => x);

            console.log("Equipes sélectionnées:", selected);

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

            // 🔥 recréer proprement
            createCheckboxFilter("filterTechnicien", [...techs], "technicien");
        });

    });
}


// ================= CHECKBOX BUILDER =================
function createCheckboxFilter(containerId, values, name) {

    const container = document.getElementById(containerId);
    if (!container) return;

    container.innerHTML = "";

    // 🔥 ACTIONS (Select All / None)
    const actions = document.createElement("div");
    actions.style.marginBottom = "8px";

    actions.innerHTML = `
        <button type="button" onclick="selectAll('${name}', true)">Tout</button>
        <button type="button" onclick="selectAll('${name}', false)">Aucun</button>
    `;

    container.appendChild(actions);

    // 🔥 CHECKBOXES
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
function selectAll(name, checked) {

    document.querySelectorAll(`input[name="${name}"]`).forEach(cb => {
        cb.checked = checked;
    });
    loadData();
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
function createGauge(el, value) {

    let chart = echarts.getInstanceByDom(el);
    if (chart) chart.dispose();

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
                        [0.4, '#16a34a'],
                        [0.6, '#f59e0b'],
                        [1, '#dc2626']
                    ]
                }
            },

            pointer: { width: 5 },

            detail: {
                formatter: val => val.toFixed(2) + " j",
                fontSize: 16
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

    // 🔥 destroy propre
    if (ctx.chart) {
        ctx.chart.destroy();
    }

    const labels = [...new Set(dataset.map(d => d.Jour))].sort();

    const grouped = {};

    dataset.forEach(d => {
        const key = d[field] || "N/A";
        if (!grouped[key]) grouped[key] = {};
        grouped[key][d.Jour] = d.Volume;
    });

    // 🎨 datasets dynamiques
    const datasets = Object.keys(grouped).map((k, index) => ({
        label: k,
        data: labels.map(m => grouped[k][m] || 0),

        borderColor: getColor(index),
        backgroundColor: getColor(index),

        fill: false
    }));

    ctx.chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },

        options: commonOptions,          // ✅ config pro appliquée
        plugins: [ChartDataLabels]       // ✅ valeurs affichées
    });
}
// ================= CHART CONFIG PRO =================
const commonOptions = {
    responsive: true,
    maintainAspectRatio: false,

    animation: {
        duration: 1000,
        easing: 'easeOutQuart'
    },

    interaction: {
        mode: 'nearest',
        axis: 'x',
        intersect: false
    },

    elements: {
        line: {
            tension: 0.4, // 🔥 courbe lissée
            borderWidth: 2
        },
        point: {
            radius: 3,
            hoverRadius: 6
        }
    },

    plugins: {
        legend: {
            display: true,
            position: 'top'
        },

        tooltip: {
            mode: 'index',
            intersect: false
        },

        datalabels: {
            color: '#000',
            anchor: 'end',
            align: 'top',
            font: {
                size: 14,
                weight: 'bold'
            },
            formatter: (value) => value > 0 ? value : ''
        }
    },

    scales: {
        x: {
            grid: { display: false }
        },
        y: {
            beginAtZero: true,
            grid: { color: '#eee' }
        }
    }
};

// 🎨 couleurs dynamiques
function getColor(index) {
    const colors = [
        '#FF6384','#36A2EB','#FFCE56',
        '#4BC0C0','#9966FF','#FF9F40',
        '#2ecc71','#e74c3c','#34495e'
    ];
    return colors[index % colors.length];
}
function toggleFilter(id) {
    const el = document.getElementById(id);
    const label = el.previousElementSibling;

    if (el.classList.contains("hidden")) {
        el.classList.remove("hidden");
        label.innerHTML = label.innerHTML.replace("▶", "▼");
    } else {
        el.classList.add("hidden");
        label.innerHTML = label.innerHTML.replace("▼", "▶");
    }
}
function drawMultiGauges(dataset) {

    const container = document.getElementById("multiGaugeContainer");
    if (!container) return;

    container.innerHTML = "";

    const grouped = {};

    // 🔥 GROUPING
    dataset.forEach(d => {
        const eq = d.Equipe || "N/A";
        if (!grouped[eq]) grouped[eq] = [];
        grouped[eq].push(d);
    });

    // 🔥 TRI (bonus pro : meilleure équipe en premier)
    const sortedEquipes = Object.keys(grouped).sort((a, b) => {
        const avgA = grouped[a].reduce((s, d) => s + (d.Delai || 0), 0) / grouped[a].length;
        const avgB = grouped[b].reduce((s, d) => s + (d.Delai || 0), 0) / grouped[b].length;
        return avgA - avgB;
    });

    // 🔥 GAUGES PAR ÉQUIPE
    sortedEquipes.forEach(eq => {

        const dataEq = grouped[eq];

        const avg = dataEq.length
            ? dataEq.reduce((sum, d) => sum + (d.Delai || 0), 0) / dataEq.length
            : 0;

        const total = dataEq.reduce((sum, d) => sum + (d.Volume || 0), 0);

        const card = document.createElement("div");
        card.className = "gauge-card";

        const title = document.createElement("div");
        title.className = "gauge-title";

        // 🎨 couleur dynamique
        if (avg > 6) title.style.color = "#dc2626";
        else if (avg > 4) title.style.color = "#f59e0b";
        else title.style.color = "#16a34a";

        // 🔥 contenu titre
        title.innerHTML = `
            ${eq}<br>
            <span style="font-size:12px;color:gray;">
                ${total} interventions • ${avg.toFixed(1)} j
            </span>
        `;

        const gaugeDiv = document.createElement("div");
        gaugeDiv.className = "gauge-box";

        card.appendChild(title);
        card.appendChild(gaugeDiv);
        container.appendChild(card);

        createGauge(gaugeDiv, avg);
    });

    // 🔥 GLOBAL
    const globalCard = document.createElement("div");
    globalCard.className = "gauge-card global-card";

    const titleGlobal = document.createElement("div");
    titleGlobal.className = "gauge-title";

    const globalAvg = dataset.length
        ? dataset.reduce((sum, d) => sum + (d.Delai || 0), 0) / dataset.length
        : 0;

    const globalTotal = dataset.reduce((sum, d) => sum + (d.Volume || 0), 0);

    titleGlobal.innerHTML = `
        GLOBAL<br>
        <span style="font-size:13px;color:#374151;">
            ${globalTotal} interventions • ${globalAvg.toFixed(1)} j
        </span>
    `;

    const gaugeGlobal = document.createElement("div");
    gaugeGlobal.className = "gauge-box";
    gaugeGlobal.style.height = "250px";

    globalCard.appendChild(titleGlobal);
    globalCard.appendChild(gaugeGlobal);
    container.appendChild(globalCard);

    createGauge(gaugeGlobal, globalAvg);
}
function createGaugeTech(el, value) {

    let chart = echarts.getInstanceByDom(el);
    if (chart) chart.dispose();

    chart = echarts.init(el);

    chart.setOption({
        series: [{
            type: 'gauge',
            min: 0,
            max: 10,

            radius: '90%',

            axisLine: {
                lineStyle: {
                    width: 10,
                    color: [
                        [0.4, '#22c55e'],
                        [0.6, '#f59e0b'],
                        [1, '#ef4444']
                    ]
                }
            },

            progress: {
                show: true,
                width: 10
            },

            pointer: {
                show: false // 🔥 style moderne sans aiguille
            },

            detail: {
                valueAnimation: true,
                formatter: val => val.toFixed(1) + " j",
                fontSize: 16,
                offsetCenter: [0, "20%"]
            },

            data: [{ value: value || 0 }]
        }]
    });
}

function drawMultiGaugesTech(dataset) {

    const container = document.getElementById("multiGaugeContainer");
    if (!container) return;

    container.innerHTML = "";

    const grouped = {};

    // 🔥 group by technicien
    dataset.forEach(d => {
        const tech = d.Technicien || "N/A";
        if (!grouped[tech]) grouped[tech] = [];
        grouped[tech].push(d);
    });

    // 🔥 tri par performance
    const sortedTechs = Object.keys(grouped).sort((a, b) => {
        const avgA = grouped[a].reduce((s, d) => s + (d.Delai || 0), 0) / grouped[a].length;
        const avgB = grouped[b].reduce((s, d) => s + (d.Delai || 0), 0) / grouped[b].length;
        return avgA - avgB;
    });

    sortedTechs.forEach(tech => {

        const dataTech = grouped[tech];

        const avg = dataTech.length
            ? dataTech.reduce((s, d) => s + (d.Delai || 0), 0) / dataTech.length
            : 0;

        const total = dataTech.reduce((s, d) => s + (d.Volume || 0), 0);

        const card = document.createElement("div");
        card.className = "gauge-card";

        const title = document.createElement("div");
        title.className = "gauge-title";

        // 🎨 couleur dynamique
        if (avg > 6) title.style.color = "#dc2626";
        else if (avg > 4) title.style.color = "#f59e0b";
        else title.style.color = "#16a34a";

        title.innerHTML = `
            ${tech}<br>
            <span style="font-size:12px;color:gray;">
                ${total} interventions • ${avg.toFixed(1)} j
            </span>
        `;

        const gaugeDiv = document.createElement("div");
        gaugeDiv.className = "gauge-box";

        card.appendChild(title);
        card.appendChild(gaugeDiv);
        container.appendChild(card);

        createGaugeTech(gaugeDiv, avg);
    });

    // 🔥 GLOBAL TECH
    const globalCard = document.createElement("div");
    globalCard.className = "gauge-card global-card";

    const globalAvg = dataset.length
        ? dataset.reduce((s, d) => s + (d.Delai || 0), 0) / dataset.length
        : 0;

    const globalTotal = dataset.reduce((s, d) => s + (d.Volume || 0), 0);

    const titleGlobal = document.createElement("div");
    titleGlobal.className = "gauge-title";

    titleGlobal.innerHTML = `
        GLOBAL TECH<br>
        <span style="font-size:13px;color:#374151;">
            ${globalTotal} interventions • ${globalAvg.toFixed(1)} j
        </span>
    `;

    const gaugeGlobal = document.createElement("div");
    gaugeGlobal.className = "gauge-box";
    gaugeGlobal.style.height = "250px";

    globalCard.appendChild(titleGlobal);
    globalCard.appendChild(gaugeGlobal);
    container.appendChild(globalCard);

    createGaugeTech(gaugeGlobal, globalAvg);
}
function drawMultiGaugesTechOnly(dataset, selectedTechs) {

    const container = document.getElementById("multiGaugeContainer");
    if (!container) return;

    container.innerHTML = "";

    const grouped = {};

    dataset.forEach(d => {
        const tech = d.Technicien || "N/A";

        // 🔥 filtrer uniquement sélection
        if (selectedTechs.length && !selectedTechs.includes(tech)) return;

        if (!grouped[tech]) grouped[tech] = [];
        grouped[tech].push(d);
    });

    Object.keys(grouped).forEach(tech => {

        const dataTech = grouped[tech];

        const avg = dataTech.length
            ? dataTech.reduce((s, d) => s + (d.Delai || 0), 0) / dataTech.length
            : 0;

        const total = dataTech.reduce((s, d) => s + (d.Volume || 0), 0);

        const card = document.createElement("div");
        card.className = "gauge-card";

        const title = document.createElement("div");
        title.className = "gauge-title";

        // 🎨 couleur dynamique
        if (avg > 6) title.style.color = "#dc2626";
        else if (avg > 4) title.style.color = "#f59e0b";
        else title.style.color = "#16a34a";

        title.innerHTML = `
            ${tech}<br>
            <span style="font-size:12px;color:gray;">
                ${total} interventions • ${avg.toFixed(1)} j
            </span>
        `;

        const gaugeDiv = document.createElement("div");
        gaugeDiv.className = "gauge-box";

        card.appendChild(title);
        card.appendChild(gaugeDiv);
        container.appendChild(card);

        createGaugeTech(gaugeDiv, avg);
    });
}
function syncTechWithEquipe(mapping) {

    const selectedEquipes = getChecked("equipe").split(",").filter(x => x);

    document.querySelectorAll("#filterTechnicien input").forEach(cb => {

        const tech = cb.value;

        const eq = mapping.find(m => m.Technicien === tech)?.Equipe;

        if (selectedEquipes.length === 0 || selectedEquipes.includes(eq)) {
            cb.parentElement.style.display = "block";
        } else {
            cb.parentElement.style.display = "none";
            cb.checked = false;
        }
    });
}
function drawTechHistogram(dataset) {

    if (!dataset || dataset.length === 0) return;

    const ctx = document.getElementById("chartTechHistogram");
    if (!ctx) return;

    if (ctx.chart) ctx.chart.destroy();

    // 🔥 1. GROUPING (corrigé)
    const grouped = {};

    dataset.forEach(d => {
        const tech = d.Technicien || "N/A";

        if (!grouped[tech]) {
            grouped[tech] = {
                volume: 0,
                delai: []
            };
        }

        grouped[tech].volume += (d.Volume || 0);
        grouped[tech].delai.push(Number(d.Delai) || 0);
    });

    // 🔥 2. TRI + CALCUL
    const sorted = Object.entries(grouped)
        .map(([tech, obj]) => {
            const avg = obj.delai.length
                ? obj.delai.reduce((a, b) => a + b, 0) / obj.delai.length
                : 0;

            return {
                tech,
                volume: obj.volume,
                avg: avg
            };
        })
        .sort((a, b) => b.volume - a.volume);

    // 🔥 3. EXTRACTION
    const labels = sorted.map(x => x.tech);
    const values = sorted.map(x => x.volume);
    const delays = sorted.map(x => x.avg);

    const colors = labels.map((_, i) => getColor(i));

    // 🔥 4. CHART
    ctx.chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Tickets",
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
                borderSkipped: false
            }]
        },

        options: {
            ...commonOptions,

            layout: {
                padding: {
                    top: 50,
                    right: 60,
                    left: 60
                }
            },

            plugins: {
                ...commonOptions.plugins,
                legend: { display: false },

                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    offset: 6,
                    clamp: true,
                    clip: false,
                    overflow: 'visible',

                    color: (context) => {
                    const avg = delays[context.dataIndex];
                    if (avg > 6) return "#dc2626";   // rouge
                    if (avg > 4) return "#f59e0b";   // orange
                    return "#16a34a";                // vert
                    },
                    font: {
                        size: 12,
                        weight: 'bold'
                    },
                    formatter: (value, context) => {
                        const avg = delays[context.dataIndex] || 0;
                        return [
                            value,
                            avg.toFixed(1) + " j"
                        ];
                    }
                }
            },

            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 30,
                        autoSkip: true
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        },

        plugins: [ChartDataLabels]
    });
}
function drawEquipeHistogram(dataset) {

    if (!dataset || dataset.length === 0) return;

    const ctx = document.getElementById("chartTechHistogram"); // 🔥 même canvas
    if (!ctx) return;

    if (ctx.chart) ctx.chart.destroy();

    // 🔥 GROUPING PAR EQUIPE
    const grouped = {};

    dataset.forEach(d => {
        const eq = d.Equipe || "N/A";

        if (!grouped[eq]) {
            grouped[eq] = {
                volume: 0,
                delai: []
            };
        }

        grouped[eq].volume += (d.Volume || 0);
        grouped[eq].delai.push(Number(d.Delai) || 0);
    });

    // 🔥 TRI
    const sorted = Object.entries(grouped)
        .map(([eq, obj]) => {
            const avg = obj.delai.length
                ? obj.delai.reduce((a, b) => a + b, 0) / obj.delai.length
                : 0;

            return {
                eq,
                volume: obj.volume,
                avg
            };
        })
        .sort((a, b) => b.volume - a.volume);

    const labels = sorted.map(x => x.eq);
    const values = sorted.map(x => x.volume);
    const delays = sorted.map(x => x.avg);

    const colors = labels.map((_, i) => getColor(i));

    // 🔥 CHART IDENTIQUE AU TECH
    ctx.chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Tickets",
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
                borderSkipped: false
            }]
        },

        options: {
            ...commonOptions,

            layout: {
                padding: {
                    top: 50,
                    right: 60,
                    left: 60
                }
            },

            plugins: {
                ...commonOptions.plugins,
                legend: { display: false },

                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    offset: 6,
                    clamp: true,
                    clip: false,
                    overflow: 'visible',
                    color: (context) => {
                        const avg = delays[context.dataIndex] || 0;
                        if (avg > 6) return "#dc2626";
                        if (avg > 4) return "#f59e0b";
                        return "#16a34a";
                    },
                    font: {
                        size: 12,
                        weight: 'bold'
                    },
                    formatter: (value, context) => {
                        const avg = delays[context.dataIndex] || 0;
                        return [
                            value,
                            avg.toFixed(1) + " j"
                        ];
                    }
                }
            },

            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 30,
                        autoSkip: false
                    }
                },
                y: {
                    beginAtZero: true
                }
            }
        },

        plugins: [ChartDataLabels]
    });
}
function toggleHistogram(show) {
    const el = document.getElementById("histogramContainer");
    if (!el) return;

    if (show) {
        el.classList.remove("hidden");
    } else {
        el.classList.add("hidden");
    }
}
function drawProduitHistogram(dataset) {

    if (!dataset || dataset.length === 0) return;

    const ctx = document.getElementById("chartTechHistogram");
    if (!ctx) return;

    if (ctx.chart) ctx.chart.destroy();

    // 🔥 GROUPING PRODUIT
    const grouped = {};

    dataset.forEach(d => {
        const prod = d.Produit || "N/A";

        if (!grouped[prod]) {
            grouped[prod] = {
                volume: 0,
                delai: []
            };
        }

        grouped[prod].volume += (d.Volume || 0);
        grouped[prod].delai.push(Number(d.Delai) || 0);
    });

    const sorted = Object.entries(grouped)
        .map(([prod, obj]) => {
            const avg = obj.delai.length
                ? obj.delai.reduce((a, b) => a + b, 0) / obj.delai.length
                : 0;

            return {
                prod,
                volume: obj.volume,
                avg
            };
        })
        .sort((a, b) => b.volume - a.volume);

    const labels = sorted.map(x => x.prod);
    const values = sorted.map(x => x.volume);
    const delays = sorted.map(x => x.avg);

    const colors = labels.map((_, i) => getColor(i));

    ctx.chart = new Chart(ctx, {
        type: "bar",
        data: {
            labels,
            datasets: [{
                label: "Tickets",
                data: values,
                backgroundColor: colors,
                borderRadius: 6,
                barPercentage: 0.7,
                categoryPercentage: 0.8,
                borderSkipped: false
            }]
        },

        options: {
            ...commonOptions,
            layout: {
                padding: { top: 50, right: 60, left: 60 }
            },
            plugins: {
                ...commonOptions.plugins,
                legend: { display: false },
                datalabels: {
                    anchor: 'end',
                    align: 'end',
                    offset: 6,
                    clamp: true,
                    clip: false,
                    overflow: 'visible',
                    color: (context) => {
                        const avg = delays[context.dataIndex] || 0;
                        if (avg > 6) return "#dc2626";
                        if (avg > 4) return "#f59e0b";
                        return "#16a34a";
                    },
                    font: { size: 12, weight: 'bold' },
                    formatter: (value, context) => {
                        const avg = delays[context.dataIndex] || 0;
                        return [
                            value,
                            avg.toFixed(1) + " j"
                        ];
                    }
                }
            },
            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 30,
                        autoSkip: false
                    }
                },
                y: { beginAtZero: true }
            }
        },
        plugins: [ChartDataLabels]
    });
}
function setHistogramTitle(text) {
    const el = document.getElementById("histogramTitle");
    if (!el) return;

    // 🔥 force refresh DOM
    el.textContent = "";
    setTimeout(() => {
        el.textContent = text;
    }, 0);
}
// ================= INIT =================
document.addEventListener("DOMContentLoaded", () => {

    console.log("✅ INIT KPI Dashboard");

    // 🔥 cacher au démarrage
    const filters = document.getElementById("filtersPanel");
    if (filters) filters.classList.add("hidden");

    const content = document.getElementById("kpiContent");
    if (content) content.classList.add("hidden");

    // 🔥 charger filtres en arrière-plan
    loadFilters();

});
