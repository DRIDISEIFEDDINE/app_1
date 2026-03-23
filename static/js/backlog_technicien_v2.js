(() => {
  const equipeSelect = document.getElementById("equipeSelect");
  const technicienSelect = document.getElementById("technicienSelect");
  const searchInput = document.getElementById("tableSearch");
  const sourcePath = document.getElementById("sourcePath");
  const exportBtn = document.getElementById("exportExcelBtn");
  const tableBody = document.querySelector("#backlogTable tbody");
  const miniBody = document.querySelector("#miniDashboardTable tbody");
  const emptyState = document.getElementById("emptyState");

  let productChart = null;
  let ageChart = null;

  const columns = [
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
    "Date de création"
  ];

  function debounce(fn, delay) {
    let timer = null;
    return (...args) => {
      clearTimeout(timer);
      timer = setTimeout(() => fn(...args), delay);
    };
  }

  function updateTechniciens() {
    const team = equipeSelect.value;
    const technicians = team ? (window.BACKLOG_TEAMS[team] || []) : [];
    technicienSelect.innerHTML = '<option value="">Tous les techniciens</option>';

    technicians.forEach((tech) => {
      const option = document.createElement("option");
      option.value = tech;
      option.textContent = tech;
      technicienSelect.appendChild(option);
    });
  }

  function setKpis(kpis) {
    document.getElementById("kpiTotal").textContent = kpis.total_tickets ?? 0;
    document.getElementById("kpiAgeMoyen").textContent = kpis.age_moyen ?? 0;
    document.getElementById("kpiAgeMax").textContent = kpis.age_max ?? 0;
    document.getElementById("kpiWfTt").textContent = kpis.wf_tt_oui ?? 0;
    document.getElementById("kpiDateRec").textContent = kpis.avec_date_rec ?? 0;
  }

  function renderTable(rows) {
    tableBody.innerHTML = "";
    emptyState.classList.toggle("hidden", rows.length > 0);

    rows.forEach((row) => {
      const tr = document.createElement("tr");

      columns.forEach((col) => {
        const td = document.createElement("td");
        td.textContent = row[col] ?? "";
        if (col === "Age Affectation" && Number(row[col] || 0) > 10) {
          td.classList.add("age-alert");
        }
        tr.appendChild(td);
      });

      tableBody.appendChild(tr);
    });
  }

  function renderMiniDashboard(rows) {
    miniBody.innerHTML = "";

    rows.forEach((row) => {
      const tr = document.createElement("tr");

      ["Equipe", "total", "age_moyen", "age_max"].forEach((key) => {
        const td = document.createElement("td");
        td.textContent = row[key] ?? "";
        tr.appendChild(td);
      });

      miniBody.appendChild(tr);
    });
  }

  function upsertChart(currentChart, canvasId, labels, values, label) {
    if (currentChart) currentChart.destroy();

    const ctx = document.getElementById(canvasId).getContext("2d");
    return new Chart(ctx, {
      type: "bar",
      data: {
        labels,
        datasets: [{
          label,
          data: values,
          borderWidth: 1,
          borderRadius: 8,
          maxBarThickness: 40
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        plugins: {
          legend: { display: false }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: { precision: 0 }
          }
        }
      }
    });
  }

  function resetUiOnError(message) {
    sourcePath.textContent = message || "Erreur de chargement";
    setKpis({
      total_tickets: 0,
      age_moyen: 0,
      age_max: 0,
      wf_tt_oui: 0,
      avec_date_rec: 0
    });
    renderTable([]);
    renderMiniDashboard([]);

    if (productChart) {
      productChart.destroy();
      productChart = null;
    }
    if (ageChart) {
      ageChart.destroy();
      ageChart = null;
    }
  }

  async function loadData() {
    const params = new URLSearchParams({
      equipe: equipeSelect.value,
      technicien: technicienSelect.value,
      search: searchInput.value
    });

    sourcePath.textContent = "Chargement...";

    try {
      const response = await fetch(`/api/backlog-technicien/data?${params.toString()}`);
      const data = await response.json();

      if (!response.ok) {
        resetUiOnError(data.error || data.source_path || "Erreur API");
        return;
      }

      sourcePath.textContent = data.source_path || "Aucune source détectée";
      setKpis(data.kpis || {});
      renderTable(data.rows || []);
      renderMiniDashboard(data.mini_dashboard_equipe || []);

      const productLabels = (data.tickets_by_product || []).map(x => x.Produit || "Non renseigné");
      const productValues = (data.tickets_by_product || []).map(x => x.count || 0);
      productChart = upsertChart(productChart, "productChart", productLabels, productValues, "Tickets");

      const ageLabels = (data.age_distribution || []).map(x => x.bucket || "Non renseigné");
      const ageValues = (data.age_distribution || []).map(x => x.count || 0);
      ageChart = upsertChart(ageChart, "ageChart", ageLabels, ageValues, "Age Affectation");
    } catch (error) {
      resetUiOnError("Erreur réseau ou serveur : " + error.message);
    }
  }

  exportBtn.addEventListener("click", () => {
    const params = new URLSearchParams({
      equipe: equipeSelect.value,
      technicien: technicienSelect.value,
      search: searchInput.value
    });

    window.location.href = `/api/backlog-technicien/export?${params.toString()}`;
  });

  equipeSelect.addEventListener("change", () => {
    updateTechniciens();
    loadData();
  });

  technicienSelect.addEventListener("change", loadData);
  searchInput.addEventListener("input", debounce(loadData, 250));

  updateTechniciens();
  loadData();
})();