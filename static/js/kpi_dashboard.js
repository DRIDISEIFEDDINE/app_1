let currentView = null;

// ================= VIEW =================
function showView(view) {

    currentView = view;

    const content = document.getElementById("kpiContent");
    if (content) content.classList.remove("hidden");

    hideAllCharts();

    if (view === "tech") showChart("chartTech");
    if (view === "equipe") showChart("chartEquipe");
    if (view === "produit") showChart("chartProduit");

    loadData();
}

// ================= RESET =================
function resetView() {
    currentView = null;

    const content = document.getElementById("kpiContent");
    if (content) content.classList.add("hidden");
}

// ================= HELPERS =================
function hideAllCharts() {
    ["chartTech", "chartEquipe", "chartProduit"].forEach(id => {
        const el = document.getElementById(id);
        if (el && el.parentElement) {
            el.parentElement.style.display = "none";
        }
    });
}

function showChart(id) {
    const el = document.getElementById(id);
    if (el && el.parentElement) {
        el.parentElement.style.display = "block";
    }
}

// ================= MULTI SELECT =================
function getMultiSelect(id) {

    const select = document.getElementById(id);
    if (!select) return "";

    return Array.from(select.selectedOptions)
        .map(opt => opt.value)
        .filter(v => v !== "")
        .join(",");
}

// ================= LOAD =================
async function loadData() {

    const loader = document.getElementById("loader");

    try {
        if (loader) loader.classList.remove("hidden");

        const params = new URLSearchParams({
            technicien: getMultiSelect("technicien"),
            produit: getMultiSelect("produit"),
            equipe: getMultiSelect("equipe"),
            date_start: document.getElementById("dateStart")?.value || "",
            date_end: document.getElementById("dateEnd")?.value || ""
        });

        const res = await fetch("/api/kpi?" + params.toString());

        if (!res.ok) throw new Error("Erreur API");

        const data = await res.json();

        if (data.error) {
            alert(data.error);
            return;
        }

        console.log("KPI DATA:", data);

        // ================= KPI =================
        const totalEl = document.getElementById("kpiTotal");
        if (totalEl) {
            totalEl.innerText = "📊 " + (data.total || 0) + " interventions";
        }

        const avg = parseFloat(data.global || 0).toFixed(2);

        let label = "Global";
        if (currentView === "tech") label = "Technicien";
        if (currentView === "equipe") label = "Equipe";
        if (currentView === "produit") label = "Produit";

        const labelEl = document.getElementById("kpiLabel");
        if (labelEl) {
            labelEl.innerText = "Moyenne DMR (" + label + ")";
        }

        // ================= CHART =================
        if (currentView === "tech") {
            drawChart("chartTech", data.tech, "Technicien");
        }

        if (currentView === "equipe") {
            drawChart("chartEquipe", data.eq, "Equipe");
        }

        if (currentView === "produit") {
            drawChart("chartProduit", data.prod, "Produit");
        }

        // ================= GAUGE =================
        drawGauge(avg);

        // ================= FILTERS (UNE SEULE FOIS) =================
        if (!window.filtersLoaded) {
            populateFilters(data);
            window.filtersLoaded = true;
        }

    } catch (err) {
        console.error("❌ KPI ERROR:", err);
        alert("Erreur chargement KPI");

    } finally {
        if (loader) loader.classList.add("hidden");
    }
}

// ================= CHART =================
function drawChart(id, dataset, field) {
    
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

    const MAX_SERIES = 8;

    // 🔥 trier par volume total
    const sortedKeys = Object.keys(grouped).sort((a, b) => {
        const sumA = Object.values(grouped[a]).reduce((x, y) => x + y, 0);
        const sumB = Object.values(grouped[b]).reduce((x, y) => x + y, 0);
        return sumB - sumA;
    });

    const datasets = sortedKeys.slice(0, MAX_SERIES).map(k => ({
        label: k,
        data: labels.map(m => grouped[k][m] || 0),
        borderWidth: 2,
        fill: false,
        tension: 0.3,
        pointRadius: 4,
        pointHoverRadius: 6
    }));
    document.querySelector("h3").innerText =
    "Produit - Volume des interventions";
    ctx.chart = new Chart(ctx, {
        type: "line",
        data: { labels, datasets },

        options: {
            responsive: true,
            maintainAspectRatio: false,

            plugins: {
                legend: {
                    position: "top"
                },
                tooltip: {
                    enabled: true
                }
            },

            scales: {
                x: {
                    ticks: {
                        maxRotation: 45,
                        minRotation: 30
                    }
                },
                y: {
                    beginAtZero: true,
                    title: {
                        display: true,
                        text: "Nombre d'interventions"
                    }
                }
            }
        },

        // 🔥 afficher valeurs sur les points
        plugins: [{
            id: 'labels',
            afterDatasetsDraw(chart) {

                const { ctx } = chart;

                chart.data.datasets.forEach((dataset, i) => {

                    const meta = chart.getDatasetMeta(i);

                    meta.data.forEach((point, index) => {

                        const value = dataset.data[index];

                        if (value === 0) return;

                        ctx.fillStyle = "#111";          
                        ctx.font = "bold 14px Arial";   
                        ctx.textAlign = "center";

                        ctx.fillText(value, point.x, point.y - 10);
                    });
                });
            }
        }]
    });
}

// ================= GAUGE =================
function drawGauge(value) {

    const el = document.getElementById("gaugeChart");
    if (!el) return;

    // 🔥 FORCER DIMENSIONS
    el.style.width = "100%";
    el.style.height = "300px";

    // 🔥 RESET PROPRE
    if (echarts.getInstanceByDom(el)) {
        echarts.dispose(el);
    }

    const chart = echarts.init(el);

    chart.setOption({
        series: [{
            type: 'gauge',
            min: 0,
            max: 10,

            axisLine: {
                lineStyle: {
                    width: 20,
                    color: [
                        [0.4, '#16a34a'],
                        [0.6, '#f59e0b'],
                        [1, '#dc2626']
                    ]
                }
            },

            pointer: {
                width: 6
            },

            detail: {
                formatter: '{value} j',
                fontSize: 20,
                offsetCenter: [0, '70%']
            },

            data: [{
                value: parseFloat(value)
            }]
        }]
    });

    // 🔥 FORCE RENDER
    setTimeout(() => {
        chart.resize();
    }, 300);
}
// ================= FILTERS =================
function populateFilters(data) {

    fill("technicien", new Set(data.tech.map(d => d.Technicien)));
    fill("produit", new Set(data.prod.map(d => d.Produit)));
    fill("equipe", new Set(data.eq.map(d => d.Equipe)));
}

function fill(id, values) {

    const el = document.getElementById(id);
    if (!el) return;

    el.innerHTML = "<option value=''>Tous</option>";

    [...values].sort().forEach(v => {
        const opt = document.createElement("option");
        opt.value = v;
        opt.textContent = v;
        el.appendChild(opt);
    });
}