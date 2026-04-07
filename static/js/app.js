Chart.register(ChartDataLabels);

let chartEquipe = null;
let chartTech = null;
let chartProd = null;
let chartAlertsWF20 = null;
let chartGov = null;
let chartAlertsAffect10 = null;
let chart5Days = null;
let progressTimer = null;
let lastStableStatus = "";
let lastStableStatusIsError = false;

function setStatus(message, isError = false) {
    const status = document.getElementById("status");
    const detail = document.getElementById("progressDetail");
    const wrapper = document.getElementById("progressWrapper");

    if (status) {
        status.textContent = message;
        status.style.color = isError ? "#b91c1c" : "#7c2d12";
        status.style.background = isError ? "#fee2e2" : "#fff7ed";
        status.style.borderColor = isError ? "#fecaca" : "#fed7aa";
    }

    if (detail) {
        detail.textContent = message || "";
    }

    if (wrapper) {
        wrapper.classList.remove("hidden");
        wrapper.classList.toggle("is-error", !!isError);
        wrapper.classList.toggle("is-success", !isError && !!message);
    }
}

function setHoverStatus(message) {
    const status = document.getElementById("status");
    status.textContent = message;
    status.style.color = "#7c2d12";
    status.style.background = "#fff7ed";
    status.style.borderColor = "#fed7aa";
}

function restoreStatusAfterHover() {
    const status = document.getElementById("status");
    status.textContent = lastStableStatus;
    status.style.color = lastStableStatusIsError ? "#b91c1c" : "#7c2d12";
    status.style.background = lastStableStatusIsError ? "#fee2e2" : "#fff7ed";
    status.style.borderColor = lastStableStatusIsError ? "#fecaca" : "#fed7aa";
}

function enableButton(id, enabled = true) {
    const el = document.getElementById(id);
    if (!el) return;
    if ("disabled" in el) {
        el.disabled = !enabled;
    }
    if (enabled) {
        el.classList.remove("disabled");
    } else {
        el.classList.add("disabled");
    }
}

function destroyIfExists(chart) {
    if (chart) {
        chart.destroy();
    }
}

function showCorrectionSummary(addressesCorrected, gpsAdded) {
    const detail = document.getElementById("progressDetail");
    if (detail) {
        detail.textContent = `Résultat de la correction : ${addressesCorrected} adresse(s) corrigée(s) — ${gpsAdded} GPS ajouté(s).`;
    }
}

function hideCorrectionSummary() {
    const box = document.getElementById("correctionSummary");
    if (box) {
        box.innerHTML = "";
        box.classList.add("hidden");
    }
}

function startProgress(labelText) {
    const wrapper = document.getElementById("progressWrapper");
    const fill = document.getElementById("progressFill");
    const label = document.getElementById("progressLabel");
    const detail = document.getElementById("progressDetail");

    wrapper.classList.remove("hidden", "is-error", "is-success");
    fill.style.width = "0%";
    label.textContent = labelText;
    if (detail) {
        detail.textContent = "Traitement en cours...";
    }

    let progress = 0;

    if (progressTimer) {
        clearInterval(progressTimer);
    }

    progressTimer = setInterval(() => {
        if (progress < 90) {
            progress += Math.random() * 10;
            if (progress > 90) progress = 90;
            fill.style.width = `${progress}%`;
        }
    }, 300);
}

function finishProgress(finalLabel = "Traitement terminé.") {
    const wrapper = document.getElementById("progressWrapper");
    const fill = document.getElementById("progressFill");
    const label = document.getElementById("progressLabel");

    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }

    fill.style.width = "100%";
    label.textContent = finalLabel;
    wrapper.classList.remove("is-error");
    wrapper.classList.add("is-success");
}

function failProgress(finalLabel = "Erreur de traitement.") {
    const wrapper = document.getElementById("progressWrapper");
    const fill = document.getElementById("progressFill");
    const label = document.getElementById("progressLabel");

    if (progressTimer) {
        clearInterval(progressTimer);
        progressTimer = null;
    }

    fill.style.width = "100%";
    label.textContent = finalLabel;
    wrapper.classList.remove("is-success");
    wrapper.classList.add("is-error");
}

function baseDataLabelsConfig(color = "#3d2b1f") {
    return {
        anchor: "end",
        align: "end",
        offset: 2,
        clamp: true,
        clip: false,
        color: color,
        font: {
            weight: "bold",
            size: 14
        },
        formatter: function (value) {
            return value;
        }
    };
}

function createBarChart(canvasId, labels, values, label, color) {
    const ctx = document.getElementById(canvasId).getContext("2d");

    return new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: label,
                    data: values,
                    backgroundColor: color,
                    borderWidth: 0
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 20,
                    right: 10,
                    left: 10,
                    bottom: 0
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    ticks: {
                        font: {
                            size: 11
                        }
                    }
                },
                x: {
                    ticks: {
                        font: {
                            size: 10
                        }
                    }
                }
            },
            plugins: {
                legend: {
                    display: false
                },
                datalabels: baseDataLabelsConfig("#7c2d12"),
                tooltip: {
                    enabled: true
                }
            }
        }
    });
}

function createPieChart(canvasId, labels, values) {
    const ctx = document.getElementById(canvasId).getContext("2d");

    return new Chart(ctx, {
        type: "pie",
        data: {
            labels: labels,
            datasets: [
                {
                    data: values
                }
            ]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            layout: {
                padding: {
                    top: 12,
                    right: 12,
                    left: 12,
                    bottom: 12
                }
            },
            plugins: {
                legend: {
                    position: "top",
                    labels: {
                        font: {
                            size: 10
                        }
                    }
                },
                datalabels: {
                    color: "#ffffff",
                    font: {
                        weight: "bold",
                        size: 15
                    },
                    formatter: function (value) {
                        return value;
                    }
                },
                tooltip: {
                    enabled: true
                }
            }
        }
    });
}

function setTextIfExists(id, value) {
    const el = document.getElementById(id);
    if (!el) return;
    el.textContent = value ?? "";
}

function updateKpis(kpis) {
    const totalTickets = Number(kpis?.total_tickets ?? 0);
    const tickets5j = Number(kpis?.tickets_5j ?? 0);
    const totalAlerts10 = Number(kpis?.total_alerts ?? 0); // ✅ FIX
    const totalWf20 = Number(kpis?.total_wf20 ?? 0);
    const totalNoOwner = Number(kpis?.tickets_sans_responsable ?? 0);

    const totalRetourFSIValue = Number(kpis?.total_retour_fsi ?? 0);
    const totalRetourFSI = String(totalRetourFSIValue);

    setTextIfExists("kpiTotal", String(totalTickets));
    setTextIfExists("kpi5j", String(tickets5j));
    setTextIfExists("kpiAlerts", String(totalAlerts10)); // ✅ FIX
    setTextIfExists("kpiWF20", String(totalWf20));
    setTextIfExists("kpiNoOwner", String(totalNoOwner));
    setTextIfExists("kpiEquipe", totalRetourFSI);
}

function renderTechnicianProductCards(cards) {
    const container = document.getElementById("techProductCards");
    container.innerHTML = "";

    if (!cards || !cards.length) {
        container.innerHTML = "<div class='tech-card'>Aucune donnée disponible.</div>";
        return;
    }

    cards.forEach((card) => {
    const wrapper = document.createElement("div");
    wrapper.className = "tech-card tech-card-exportable";

    const total5j = Number(card.tickets5j ?? 0);
    const totalAlerts10 = Number(card.alerts10 ?? 0); // ✅ FIX ICI

    const techName = String(card.technicien ?? "").trim();
    const hoverMessage = `Cliquer pour exporter le détail Excel des tickets de ${techName}.`;

    console.log("CARD DATA:", card);

    let html = `
        <div class="tech-card-header">
            <h4>${techName}</h4>
            <div class="tech-header-actions">

         <img src="/static_mail_icon" 
         class="card-mail-icon tech-mail-icon"
         title="Envoyer par mail"
         onclick="event.stopPropagation(); sendMailForTech(\`${techName}\`)"

    <img src="/static_excel_icon" 
         alt="Excel" 
         class="card-excel-icon tech-excel-icon" />
                <div class="tech-alert-badge">> 10 j : ${totalAlerts10}</div>
                <div class="tech-alert-badge">Toc = 5 j : ${total5j}</div>
                <img src="/static_excel_icon" alt="Excel" class="card-excel-icon tech-excel-icon" />
            </div>
        </div>
        <div class="tech-card-tooltip">${hoverMessage}</div>
    `;
   
    card.details.forEach((item) => {
        html += `
            <div class="tech-item">
                <span>${item.produit}</span>
                <span class="count">${item.nombre}</span>
            </div>
        `;
    });

    wrapper.innerHTML = html;

    wrapper.setAttribute("title", hoverMessage);

    wrapper.addEventListener("mouseenter", () => setHoverStatus(hoverMessage));
    wrapper.addEventListener("mouseleave", () => restoreStatusAfterHover());
    wrapper.addEventListener("click", () => {
        window.location.href = `/export_tech_card_details/${encodeURIComponent(techName)}`;
    });

    container.appendChild(wrapper);
});
}

function updateDashboard(dashboard) {
    window.dashboardData = dashboard;
    destroyIfExists(chartEquipe);
    destroyIfExists(chartTech);
    destroyIfExists(chartProd);
    destroyIfExists(chart5Days);
    destroyIfExists(chartAlertsWF20);
    destroyIfExists(chartGov);
    destroyIfExists(chartAlertsAffect10);

    chartEquipe = createBarChart(
        "chartEquipe",
        dashboard.equipe.labels,
        dashboard.equipe.values,
        "Backlog",
        "#d97706"
    );

    chartTech = createBarChart(
        "chartTech",
        dashboard.technicien.labels,
        dashboard.technicien.values,
        "Tickets",
        "#f59e0b"
    );

    chartProd = createPieChart(
        "chartProd",
        dashboard.produit.labels,
        dashboard.produit.values
    );

    chartAlertsWF20 = createBarChart(
        "chartAlertsWF20",
        dashboard.alertes_wf_20.labels,
        dashboard.alertes_wf_20.values,
        "Alertes WF TT >= 20 jours",
        "#c0392b"
    );

    chartGov = createBarChart(
        "chartGov",
        dashboard.gouvernorat.labels,
        dashboard.gouvernorat.values,
        "Tickets",
        "#e28a00"
    );

    chartAlertsAffect10 = createBarChart(
        "chartAlertsAffect10",
        dashboard.alertes_affect_10.labels,
        dashboard.alertes_affect_10.values,
        "Tickets > 10 jours",
        "#cf3f2c"
    );
    chart5Days = createBarChart(
    "chart5Days",
    dashboard.tickets_5j.labels,
    dashboard.tickets_5j.values,
    "Tickets = 5 jours",
    "#f97316"
    );
    updateKpis(dashboard.kpis);
    renderTechnicianProductCards(dashboard.technician_product_cards);
}

document.getElementById("uploadForm").addEventListener("submit", async function (e) {
    e.preventDefault();

    const filesInput = document.getElementById("files");

    if (!filesInput.files.length) {
        setStatus("Veuillez sélectionner au moins un fichier Excel.", true);
        return;
    }

    hideCorrectionSummary();
    startProgress("Fusion et traitement des fichiers Excel...");
    setStatus("Traitement en cours...");

    const formData = new FormData();
    for (const file of filesInput.files) {
        formData.append("files", file);
    }

    try {
        const response = await fetch("/process", {
            method: "POST",
            body: formData
        });

        const data = await response.json();

        if (!data.success) {
            failProgress("Erreur pendant le traitement.");
            setStatus(data.message || "Erreur de traitement.", true);
            return;
        }

        finishProgress("Fusion terminée.");
        setStatus(data.message);
        updateDashboard(data.dashboard);

        const btnDownload = document.getElementById("btnDownload");
        btnDownload.href = data.download_url;

        enableButton("btnDownload", true);
        enableButton("btnCorrect", true);
        enableButton("btnPdf", true);
    } catch (error) {
        failProgress("Erreur réseau ou serveur.");
        setStatus("Erreur réseau ou serveur : " + error.message, true);
    }
});

document.getElementById("btnCorrect").addEventListener("click", async function () {
    hideCorrectionSummary();
    startProgress("Correction des adresses et ajout des coordonnées GPS...");
    setStatus("Correction des adresses et GPS en cours...");

    try {
        const response = await fetch("/correct_addresses_gps", {
            method: "POST"
        });

        const data = await response.json();

        if (!data.success) {
            failProgress("Erreur lors de la correction.");
            setStatus(data.message || "Erreur lors de la correction.", true);
            return;
        }

        finishProgress("Correction Adresse/GPS terminée.");
        setStatus(data.message);
        updateDashboard(data.dashboard);

        if (data.correction_stats) {
            showCorrectionSummary(
                data.correction_stats.addresses_corrected ?? 0,
                data.correction_stats.gps_added ?? 0
            );
        }

        const btnDownload = document.getElementById("btnDownload");
        btnDownload.href = data.download_url;

        enableButton("btnDownload", true);
        enableButton("btnPdf", true);
    } catch (error) {
        failProgress("Erreur réseau ou serveur.");
        setStatus("Erreur réseau ou serveur : " + error.message, true);
    }
});




function initKpiExportCards() {
    const kpiConfigs = [
        {
            cardId: "kpiAlertsCard",
            kind: "alerts10",
            hoverMessage: "Cliquer sur la carte pour exporter le détail Excel des tickets avec Age Affectation > 10 jours."
        },
        {
            cardId: "kpi5jCard",
            kind: "tickets5j",
            hoverMessage: "Cliquer pour exporter les tickets avec Age Affectation = 5 jours."
        },
        {
            cardId: "kpiRetourFSICard",
            kind: "retourfsi",
            hoverMessage: "Cliquer sur la carte pour exporter le détail Excel des tickets Retour FSI."
        },
        {
            cardId: "kpiWF20Card",
            kind: "wf20",
            hoverMessage: "Cliquer sur la carte pour exporter le détail Excel des tickets avec Age WF TT >= 20 jours."
        },
        {
            cardId: "kpiNoOwnerCard",
            kind: "sansresp",
            hoverMessage: "Cliquer sur la carte pour exporter le détail Excel des tickets sans responsable."
        }
    ];

    kpiConfigs.forEach((cfg) => {
        const card = document.getElementById(cfg.cardId);
        if (!card) return;

        card.setAttribute("title", cfg.hoverMessage);

        card.addEventListener("mouseenter", () => {
            setHoverStatus(cfg.hoverMessage);
        });

        card.addEventListener("mouseleave", () => {
            restoreStatusAfterHover();
        });

        card.addEventListener("click", () => {
            window.location.href = `/export_kpi_details/${cfg.kind}`;
        });
    });
}

initKpiExportCards();


function initAnimatedTitle() {
    const title = document.getElementById("animatedTitle");
    if (!title) return;

    const text = (title.getAttribute("aria-label") || title.textContent || "").trim();
    title.textContent = "";

    [...text].forEach((char, index) => {
        const span = document.createElement("span");
        span.className = "letter";
        span.style.setProperty("--i", index);
        span.textContent = char === " " ? " " : char;
        title.appendChild(span);
    });
}

initAnimatedTitle();


const btnBacklogTech = document.getElementById("btnBacklogTech");
if (btnBacklogTech) {
    btnBacklogTech.setAttribute("title", "Ouvrir la page Backlog par technicien");
}
document.addEventListener("DOMContentLoaded", () => {

    const mailIcon = document.getElementById("mailIcon");

    if (mailIcon) {
        mailIcon.style.cursor = "pointer";

        mailIcon.title = "Envoyer mail backlog";

        mailIcon.addEventListener("click", (e) => {
            e.stopPropagation();

            if (!confirm("Envoyer le backlog par mail ?")) return;

 sendMailWithCharts();
  });
    }

});

async function sendMailWithCharts() {

    const charts = [
        "chartTech",
        "chartAlertsAffect10",
        "chartGov",
        "chartProd"
    ];

    const images = {};

    charts.forEach(id => {
        const canvas = document.getElementById(id);
        if (canvas) {
            images[id] = canvas.toDataURL("image/png");
        }
    });

    try {
        const response = await fetch("/send_mail", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({ charts: images })
        });

        const data = await response.json();
        alert(data.message || "Mail envoyé !");

    } catch (error) {
        alert("Erreur lors de l'envoi du mail");
    }
}
async function sendMailForTech(techName) {

    const cards = window.dashboardData?.technician_product_cards || [];

    function normalizeName(name) {
    return (name || "")
        .toLowerCase()
        .trim()
        .replace(/\s+/g, " ");
    }

        const techData = cards.find(
        c => normalizeName(c.technicien) === normalizeName(techName)
    );
    console.log("CLICKED:", techName);
    console.log("CARDS:", cards.map(c => c.technicien));
    if (!techData) {
        alert("Technicien introuvable");
        return;
    }

    // 🔥 confirmation
    if (!confirm(`Envoyer le backlog de ${techName} ?`)) return;

    try {
        const response = await fetch("/send_mail_tech", {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                technicien: techName,
                data: techData
            })
        });

        const result = await response.json();

        alert(result.message || "Mail envoyé");

    } catch (err) {
        console.error(err);
        alert("Erreur envoi mail");
    }
}