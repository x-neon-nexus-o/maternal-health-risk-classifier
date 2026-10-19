/**
 * MaternaCare AI — Web Application Frontend Script
 */

document.addEventListener("DOMContentLoaded", () => {
  // --- Preset Profiles ---
  const PRESETS = {
    low: {
      Age: 25,
      SystolicBP: 110,
      DiastolicBP: 70,
      BS: 6.8,
      BodyTemp: 98.0,
      HeartRate: 72,
    },
    mid: {
      Age: 28,
      SystolicBP: 120,
      DiastolicBP: 80,
      BS: 8.0,
      BodyTemp: 98.8,
      HeartRate: 76,
    },
    high: {
      Age: 38,
      SystolicBP: 140,
      DiastolicBP: 95,
      BS: 14.0,
      BodyTemp: 99.5,
      HeartRate: 88,
    },
  };

  const FIELDS = ["Age", "SystolicBP", "DiastolicBP", "BS", "BodyTemp", "HeartRate"];

  // --- Two-Way Range Slider & Number Input Sync ---
  FIELDS.forEach((field) => {
    const slider = document.getElementById(`slider${field}`);
    const numInput = document.getElementById(`input${field}`);

    if (slider && numInput) {
      slider.addEventListener("input", (e) => {
        numInput.value = e.target.value;
      });

      numInput.addEventListener("input", (e) => {
        slider.value = e.target.value;
      });
    }
  });

  // --- Quick Presets ---
  document.querySelectorAll(".preset-pill").forEach((pill) => {
    pill.addEventListener("click", () => {
      const pKey = pill.getAttribute("data-preset");
      const values = PRESETS[pKey];
      if (values) {
        FIELDS.forEach((f) => {
          const numInput = document.getElementById(`input${f}`);
          const slider = document.getElementById(`slider${f}`);
          if (numInput && slider) {
            numInput.value = values[f];
            slider.value = values[f];
          }
        });
        // Auto trigger prediction
        submitPrediction();
      }
    });
  });

  // --- Form Reset ---
  const resetBtn = document.getElementById("resetFormBtn");
  if (resetBtn) {
    resetBtn.addEventListener("click", () => {
      FIELDS.forEach((f) => {
        const numInput = document.getElementById(`input${f}`);
        const slider = document.getElementById(`slider${f}`);
        if (numInput && slider) {
          numInput.value = "";
          slider.value = slider.getAttribute("min") || 50;
        }
      });
      document.getElementById("resultInitialState").style.display = "block";
      document.getElementById("resultActiveState").style.display = "none";
      document.getElementById("clinicalContextSection").style.display = "none";
    });
  }

  // --- Prediction Form Submit ---
  const predictionForm = document.getElementById("predictionForm");
  if (predictionForm) {
    predictionForm.addEventListener("submit", (e) => {
      e.preventDefault();
      submitPrediction();
    });
  }

  async function submitPrediction() {
    const submitBtn = document.getElementById("submitPredictBtn");
    const btnText = submitBtn.querySelector(".btn-text");
    const btnSpinner = submitBtn.querySelector(".spinner-loader");

    // Gather values
    const payload = {};
    for (const f of FIELDS) {
      const val = parseFloat(document.getElementById(`input${f}`).value);
      if (isNaN(val)) {
        alert(`Please enter a valid numeric value for ${f}`);
        return;
      }
      payload[f] = val;
    }

    if (payload.SystolicBP < payload.DiastolicBP) {
      alert("Validation Error: SystolicBP must be greater than or equal to DiastolicBP.");
      return;
    }

    // Set loading
    btnText.style.display = "none";
    btnSpinner.style.display = "inline-flex";
    submitBtn.disabled = true;

    try {
      const res = await fetch("/api/predict", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (!data.success) {
        alert(`Prediction Error: ${data.error || "Unable to complete assessment"}`);
        return;
      }

      renderPredictionResult(data);
    } catch (err) {
      console.error(err);
      alert("Failed to connect to the server. Please check that the app is running.");
    } finally {
      btnText.style.display = "inline-flex";
      btnSpinner.style.display = "none";
      submitBtn.disabled = false;
    }
  }

  function renderPredictionResult(data) {
    const initialState = document.getElementById("resultInitialState");
    const activeState = document.getElementById("resultActiveState");
    const timestampPill = document.getElementById("assessmentTimestamp");

    initialState.style.display = "none";
    activeState.style.display = "flex";

    const now = new Date();
    timestampPill.textContent = `Evaluated at ${now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' })}`;

    const label = data.prediction; // 'low risk', 'mid risk', or 'high risk'
    const probs = data.probabilities || {};

    const heroCard = document.getElementById("riskHeroCard");
    const heroIcon = document.getElementById("riskHeroIcon");
    const statusPill = document.getElementById("riskStatusPill");
    const title = document.getElementById("riskTitle");
    const desc = document.getElementById("riskDesc");
    const topConf = document.getElementById("topConfidenceVal");

    // Reset card classes
    heroCard.className = "risk-hero-card";

    if (label === "low risk") {
      heroCard.classList.add("risk-low");
      heroIcon.innerHTML = '<i class="fa-solid fa-shield-heart"></i>';
      statusPill.textContent = "✓ OPTIMAL / LOW RISK LEVEL";
      title.textContent = "Low Risk Profile";
      desc.textContent = "All evaluated maternal parameters align with low clinical complication risk in the dataset.";
    } else if (label === "mid risk") {
      heroCard.classList.add("risk-mid");
      heroIcon.innerHTML = '<i class="fa-solid fa-triangle-exclamation"></i>';
      statusPill.textContent = "⚠️ MODERATE / MID RISK LEVEL";
      title.textContent = "Mid Risk Profile";
      desc.textContent = "Borderline vital indicators observed. Routine clinical monitoring and follow-up recommended.";
    } else {
      heroCard.classList.add("risk-high");
      heroIcon.innerHTML = '<i class="fa-solid fa-circle-radiation"></i>';
      statusPill.textContent = "🚨 HIGH RISK CLUSTER DETECTED";
      title.textContent = "High Risk Profile";
      desc.textContent = "Elevated glycemic or blood pressure biomarkers detected matching high-risk cohort profiles.";
    }

    const maxProb = probs[label] !== undefined ? probs[label] : 0;
    topConf.textContent = `${(maxProb * 100).toFixed(1)}%`;

    // Probability Bars
    const pLow = probs["low risk"] || 0;
    const pMid = probs["mid risk"] || 0;
    const pHigh = probs["high risk"] || 0;

    document.getElementById("pctLowRisk").textContent = `${(pLow * 100).toFixed(1)}%`;
    document.getElementById("fillLowRisk").style.width = `${(pLow * 100).toFixed(1)}%`;

    document.getElementById("pctMidRisk").textContent = `${(pMid * 100).toFixed(1)}%`;
    document.getElementById("fillMidRisk").style.width = `${(pMid * 100).toFixed(1)}%`;

    document.getElementById("pctHighRisk").textContent = `${(pHigh * 100).toFixed(1)}%`;
    document.getElementById("fillHighRisk").style.width = `${(pHigh * 100).toFixed(1)}%`;

    // Clinical Flags
    const flagsContainer = document.getElementById("flagsContainer");
    flagsContainer.innerHTML = "";
    const flags = data.flags || [];

    if (flags.length === 0) {
      flagsContainer.innerHTML = `
        <div class="flag-item flag-normal">
          <i class="fa-solid fa-check-circle"></i>
          <span>No critical physiological thresholds exceeded. Vitals appear within normal ranges.</span>
        </div>
      `;
    } else {
      flags.forEach((f) => {
        const item = document.createElement("div");
        item.className = `flag-item flag-${f.type}`;
        const icon = f.type === "high" ? "fa-circle-exclamation" : (f.type === "warning" ? "fa-triangle-exclamation" : "fa-circle-info");
        item.innerHTML = `<i class="fa-solid ${icon}"></i> <span>${f.text}</span>`;
        flagsContainer.appendChild(item);
      });
    }

    // Fetch and render clinical context (evidence-based associations)
    const payload = {};
    FIELDS.forEach((f) => {
      payload[f] = parseFloat(document.getElementById(`input${f}`).value);
    });
    fetchAndRenderClinicalContext(payload);
  }

  // --- Clinical Context Rendering ---
  async function fetchAndRenderClinicalContext(payload) {
    try {
      const res = await fetch("/api/clinical-context", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (data.success) {
        renderClinicalContext(data.data);
      }
    } catch (err) {
      console.error("Failed to fetch clinical context:", err);
    }
  }

  function renderClinicalContext(contextData) {
    const section = document.getElementById("clinicalContextSection");
    const container = document.getElementById("clinicalContextContainer");
    const disclaimerEl = document.getElementById("clinicalDisclaimer");

    if (!contextData.findings || contextData.findings.length === 0) {
      container.innerHTML = `
        <div class="context-empty">
          <i class="fa-solid fa-circle-check"></i>
          <p>No specific clinical thresholds exceeded. All biomarkers fall within normal reference ranges.</p>
        </div>
      `;
    } else {
      let html = "";
      contextData.findings.forEach((f) => {
        const levelClass = f.level === "high" ? "high" : (f.level === "warning" ? "warning" : "info");
        const levelLabel = f.level === "high" ? "HIGH" : (f.level === "warning" ? "WARNING" : "INFO");
        const levelBadgeClass = f.level === "high" ? "context-level-high" : (f.level === "warning" ? "context-level-warning" : "context-level-info");
        
        const associationsHtml = f.associations.map(a => `<li>${a}</li>`).join("");
        const guidelinesHtml = f.guidelines.map(g => `<li>${g}</li>`).join("");
        
        html += `
          <div class="context-card ${levelClass}">
            <div class="context-header">
              <span class="context-biomarker">${f.biomarker}</span>
              <span class="context-condition">${f.condition}</span>
              <span class="context-level-badge ${levelBadgeClass}">${levelLabel}</span>
            </div>
            <div class="context-value">Input value: ${f.value} ${getUnit(f.biomarker)}</div>
            
            <div class="context-associations">
              <div class="context-associations-title"><i class="fa-solid fa-link"></i> Evidence-Based Associations</div>
              <ul class="context-associations-list">
                ${associationsHtml}
              </ul>
            </div>
            
            <div class="context-guidelines">
              <div class="context-guidelines-title"><i class="fa-solid fa-gavel"></i> Guideline References</div>
              <ul class="context-guidelines-list">
                ${guidelinesHtml}
              </ul>
            </div>
          </div>
        `;
      });
      container.innerHTML = html;
    }

    disclaimerEl.innerHTML = contextData.disclaimer;
    section.style.display = "block";
  }

  function getUnit(field) {
    const units = {
      Age: "years",
      SystolicBP: "mmHg",
      DiastolicBP: "mmHg",
      BS: "mmol/L",
      BodyTemp: "°F",
      HeartRate: "bpm"
    };
    return units[field] || "";
  }
  const perfModal = document.getElementById("perfModal");
  const openPerfBtn = document.getElementById("openPerfModalBtn");
  const closePerfBtn = document.getElementById("closePerfModalBtn");
  const modalBody = document.getElementById("modalDynamicBody");
  const tabButtons = document.querySelectorAll(".modal-tabs .tab-btn");

  let cachedPerfData = null;
  let activeTabName = "Random Forest";

  if (openPerfBtn) {
    openPerfBtn.addEventListener("click", () => {
      openPerformanceModal();
    });
  }

  if (closePerfBtn) {
    closePerfBtn.addEventListener("click", () => {
      closePerformanceModal();
    });
  }

  // Close when clicking outside modal container
  if (perfModal) {
    perfModal.addEventListener("click", (e) => {
      if (e.target === perfModal) {
        closePerformanceModal();
      }
    });
  }

  // Close on Escape key
  document.addEventListener("keydown", (e) => {
    if (e.key === "Escape" && perfModal.classList.contains("active")) {
      closePerformanceModal();
    }
  });

  // Switch tabs
  tabButtons.forEach((btn) => {
    btn.addEventListener("click", () => {
      tabButtons.forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      activeTabName = btn.getAttribute("data-tab");
      if (cachedPerfData) {
        renderModalContent(activeTabName, cachedPerfData);
      }
    });
  });

  async function openPerformanceModal() {
    perfModal.classList.add("active");
    if (!cachedPerfData) {
      modalBody.innerHTML = `
        <div class="modal-loading">
          <i class="fa-solid fa-spinner fa-spin"></i> Loading test set metrics and confusion matrices...
        </div>
      `;
      try {
        const res = await fetch("/api/performance");
        const json = await res.json();
        if (json.success) {
          cachedPerfData = json.data;
          renderModalContent(activeTabName, cachedPerfData);
        } else {
          modalBody.innerHTML = `<p style="color: #ef4444; text-align: center;">Error loading performance data: ${json.error}</p>`;
        }
      } catch (err) {
        console.error(err);
        modalBody.innerHTML = `<p style="color: #ef4444; text-align: center;">Network error while fetching performance data.</p>`;
      }
    } else {
      renderModalContent(activeTabName, cachedPerfData);
    }
  }

  function closePerformanceModal() {
    perfModal.classList.remove("active");
  }

  function renderModalContent(tabName, perfData) {
    if (tabName === "Comparison Table") {
      renderComparisonTable(perfData);
    } else {
      renderModelDetails(tabName, perfData);
    }
  }

  function renderModelDetails(modelName, perfData) {
    const model = perfData.models[modelName];
    if (!model) {
      modalBody.innerHTML = `<p>Model data not found for ${modelName}</p>`;
      return;
    }

    const acc = (model.accuracy * 100).toFixed(2);
    const prec = (model.precision_macro * 100).toFixed(2);
    const rec = (model.recall_macro * 100).toFixed(2);
    const f1 = (model.f1_macro * 100).toFixed(2);
    const cm = model.confusion_matrix;
    const rep = model.report;

    const safeName = modelName.toLowerCase().replace(/ /g, "_");
    const figUrl = `/figures/06_confusion_${safeName}.png`;

    const hrRecall = rep["high risk"] ? (rep["high risk"].recall * 100).toFixed(2) : "0.0";

    modalBody.innerHTML = `
      <!-- Top 4 KPIs -->
      <div class="kpi-row">
        <div class="kpi-card">
          <div class="kpi-bar" style="background: #2563eb;"></div>
          <div class="kpi-title">Accuracy</div>
          <div class="kpi-value">${acc}%</div>
          <div class="kpi-sub">Overall test correctness</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-bar" style="background: #0891b2;"></div>
          <div class="kpi-title">Macro Precision</div>
          <div class="kpi-value">${prec}%</div>
          <div class="kpi-sub">Avg positive predictive value</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-bar" style="background: #10b981;"></div>
          <div class="kpi-title">Macro Recall</div>
          <div class="kpi-value">${rec}%</div>
          <div class="kpi-sub">Avg sensitivity across classes</div>
        </div>
        <div class="kpi-card">
          <div class="kpi-bar" style="background: #8b5cf6;"></div>
          <div class="kpi-title">Macro F1-Score</div>
          <div class="kpi-value">${f1}%</div>
          <div class="kpi-sub">Harmonic precision/recall mean</div>
        </div>
      </div>

      <!-- Two-Pane Layout: Confusion Matrix & Classification Report -->
      <div class="perf-details-grid">
        
        <!-- Left: Confusion Matrix -->
        <div class="perf-panel">
          <h4 class="panel-heading"><i class="fa-solid fa-chart-area"></i> Confusion Matrix Plot & Numbers</h4>
          
          <div class="cm-img-wrap">
            <img src="${figUrl}" alt="Confusion Matrix: ${modelName}" onerror="this.style.display='none'">
          </div>

          <table class="cm-table">
            <thead>
              <tr>
                <th>True \\ Pred</th>
                <th>Low Risk</th>
                <th>Mid Risk</th>
                <th>High Risk</th>
                <th>Total</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="font-weight:700;">Low Risk</td>
                <td class="diag-cell">${cm[0][0]}</td>
                <td class="off-cell">${cm[0][1]}</td>
                <td class="off-cell">${cm[0][2]}</td>
                <td style="font-weight:700;">${cm[0][0] + cm[0][1] + cm[0][2]}</td>
              </tr>
              <tr>
                <td style="font-weight:700;">Mid Risk</td>
                <td class="off-cell">${cm[1][0]}</td>
                <td class="diag-cell">${cm[1][1]}</td>
                <td class="off-cell">${cm[1][2]}</td>
                <td style="font-weight:700;">${cm[1][0] + cm[1][1] + cm[1][2]}</td>
              </tr>
              <tr>
                <td style="font-weight:700;">High Risk</td>
                <td class="off-cell">${cm[2][0]}</td>
                <td class="off-cell">${cm[2][1]}</td>
                <td class="diag-cell">${cm[2][2]}</td>
                <td style="font-weight:700;">${cm[2][0] + cm[2][1] + cm[2][2]}</td>
              </tr>
            </tbody>
          </table>
        </div>

        <!-- Right: Per-Class Report & Clinical Analysis -->
        <div class="perf-panel">
          <h4 class="panel-heading"><i class="fa-solid fa-list-check"></i> Per-Class Evaluation Breakdown</h4>

          <table class="metrics-table">
            <thead>
              <tr>
                <th style="text-align:left;">Class</th>
                <th>Precision</th>
                <th>Recall</th>
                <th>F1-Score</th>
                <th>Support</th>
              </tr>
            </thead>
            <tbody>
              <tr>
                <td style="text-align:left; font-weight:700;">Low Risk</td>
                <td>${(rep['low risk'].precision * 100).toFixed(1)}%</td>
                <td>${(rep['low risk'].recall * 100).toFixed(1)}%</td>
                <td>${(rep['low risk']['f1-score'] * 100).toFixed(1)}%</td>
                <td>${rep['low risk'].support}</td>
              </tr>
              <tr>
                <td style="text-align:left; font-weight:700;">Mid Risk</td>
                <td>${(rep['mid risk'].precision * 100).toFixed(1)}%</td>
                <td>${(rep['mid risk'].recall * 100).toFixed(1)}%</td>
                <td>${(rep['mid risk']['f1-score'] * 100).toFixed(1)}%</td>
                <td>${rep['mid risk'].support}</td>
              </tr>
              <tr>
                <td style="text-align:left; font-weight:700; color:#dc2626;">High Risk</td>
                <td style="color:#dc2626; font-weight:700;">${(rep['high risk'].precision * 100).toFixed(1)}%</td>
                <td style="color:#dc2626; font-weight:700;">${(rep['high risk'].recall * 100).toFixed(1)}%</td>
                <td style="color:#dc2626; font-weight:700;">${(rep['high risk']['f1-score'] * 100).toFixed(1)}%</td>
                <td>${rep['high risk'].support}</td>
              </tr>
            </tbody>
          </table>

          <div class="clinical-callout">
            <h5><i class="fa-solid fa-lightbulb"></i> Clinical Insight: High-Risk Recall (${hrRecall}%)</h5>
            <p>For maternal healthcare monitoring, capturing true high-risk cases is critical to avoid false negatives. ${modelName} attained <strong>${hrRecall}% High-Risk Recall</strong> (capturing ${cm[2][2]} of 55 high-risk test instances).</p>
          </div>
        </div>

      </div>
    `;
  }

  function renderComparisonTable(perfData) {
    const summary = perfData.summary || [];

    let tableRows = "";
    summary.forEach((row) => {
      const isBest = row.Model === "Random Forest";
      tableRows += `
        <tr class="${isBest ? 'best-row' : ''}">
          <td style="text-align:left; font-weight:700;">
            ${isBest ? '★ ' : ''}${row.Model}
          </td>
          <td>${row.Accuracy}</td>
          <td>${row['Precision (macro)']}</td>
          <td>${row['Recall (macro)']}</td>
          <td>${row['F1 (macro)']}</td>
          <td>${row['High-risk Recall']}</td>
          <td>${isBest ? '<span class="badge-status-best">Selected Best</span>' : '<span style="color:#64748b;">Baseline</span>'}</td>
        </tr>
      `;
    });

    modalBody.innerHTML = `
      <div class="comparison-container">
        <h4 class="panel-heading" style="margin-bottom: 0.5rem;"><i class="fa-solid fa-trophy"></i> Multi-Model Test Set Performance Comparison</h4>
        <p style="font-size: 0.78rem; color: #64748b; margin-bottom: 1.25rem;">
          Evaluated under an 80/20 stratified split (${perfData.test_total} test records, random_state=42). Macro-averaging ensures equal weight for all three risk categories.
        </p>

        <div class="table-responsive">
          <table class="comparison-table">
            <thead>
              <tr>
                <th style="text-align:left;">Model</th>
                <th>Accuracy</th>
                <th>Macro Precision</th>
                <th>Macro Recall</th>
                <th>Macro F1-Score</th>
                <th>High-Risk Recall</th>
                <th>Status</th>
              </tr>
            </thead>
            <tbody>
              ${tableRows}
            </tbody>
          </table>
        </div>

        <div class="clinical-callout">
          <h5><i class="fa-solid fa-scale-balanced"></i> Architectural Justification for Random Forest:</h5>
          <p>• Random Forest (100 trees) achieves the highest Macro F1 (86.98%) and overall accuracy (86.21%), effectively mitigating single-tree overfitting.<br>
             • Decision Tree (83.74% acc) handles non-linear boundaries but has lower stability.<br>
             • Logistic Regression (62.07% acc) serves as a linear baseline but struggles with overlapping mid-risk and low-risk distributions.</p>
        </div>
      </div>
    `;
  }
});
