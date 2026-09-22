const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const amount = (value) => value === null || value === "" ? "—" : euro.format(value);
const esc = (value) => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const lineAmount = (lines, name) => lines.find(item => item.line === name)?.amountEUR;
const totalNames = new Set(["Revenue", "Gross profit", "Profit before unquantified insurance", "Closing cash", "Total assets", "Total liabilities", "Equity", "Total liabilities and equity", "Balance check"]);

async function loadSubmission() {
  const response = await fetch("/submission.json", { cache: "no-store" });
  if (!response.ok) throw new Error("The submission data could not be loaded.");
  return response.json();
}

function renderStatement(title, lines) {
  return `<article class="statement-card"><h3>${esc(title)}</h3><dl>${lines.map(item => `<div class="${totalNames.has(item.line) ? "total" : ""}"><dt>${esc(item.line)}</dt><dd class="${Number(item.amountEUR) < 0 ? "negative" : ""}">${amount(item.amountEUR)}</dd></div>`).join("")}</dl></article>`;
}

function renderDecisions(data) {
  const tbody = document.querySelector("#decision-table");
  const search = document.querySelector("#decision-search");
  const filter = document.querySelector("#decision-filter");
  const count = document.querySelector("#decision-count");
  const draw = () => {
    const term = search.value.trim().toLowerCase();
    const mode = filter.value;
    const visible = data.decisions.filter(d => {
      const matchText = [d.id, d.question, d.answer, ...d.evidence].join(" ").toLowerCase().includes(term);
      const matchMode = mode === "all" || d.reviewTier === mode || (mode === "low" && d.confidence === "low");
      return matchText && matchMode;
    });
    count.textContent = `Showing ${visible.length} of ${data.decisions.length} certified decisions`;
    tbody.innerHTML = visible.map(d => `<tr><td><strong>${esc(d.id)}</strong></td><td><span class="pill ${d.reviewTier === "material_judgment" ? "material" : ""}">${d.reviewTier === "material_judgment" ? "Material" : "Operational"}</span></td><td>${esc(d.question)}</td><td>${esc(d.answer)}</td><td>${d.evidence.map(esc).join(" · ")}</td><td><span class="pill ${esc(d.confidence)}">${esc(d.confidence)}</span></td></tr>`).join("");
  };
  search.addEventListener("input", draw);
  filter.addEventListener("change", draw);
  draw();
}

function renderSchedules(schedules) {
  const tabs = document.querySelector("#schedule-tabs");
  const panel = document.querySelector("#schedule-panel");
  const labels = {
    revenueAndReceivables: "Revenue & AR", payroll: "Payroll", operatingExpenses: "Operating expenses",
    inventoryAndCOGS: "Inventory & COGS", ppe: "PPE", debtAndInterest: "Debt & interest", equityAndDistributions: "Equity"
  };
  const entries = Object.entries(schedules);
  function show(key) {
    const records = schedules[key];
    tabs.querySelectorAll("button").forEach(button => button.setAttribute("aria-selected", String(button.dataset.key === key)));
    const headers = [...new Set(records.flatMap(record => Object.keys(record)))];
    panel.innerHTML = `<table><thead><tr>${headers.map(h => `<th>${esc(h.replace(/([A-Z])/g, " $1"))}</th>`).join("")}</tr></thead><tbody>${records.map(record => `<tr>${headers.map(h => `<td>${typeof record[h] === "number" && /EUR|amount|invoice|cash|revenue|write|receivable|liability/i.test(h) ? amount(record[h]) : esc(record[h] ?? "—")}</td>`).join("")}</tr>`).join("")}</tbody></table>`;
  }
  tabs.innerHTML = entries.map(([key]) => `<button type="button" role="tab" data-key="${esc(key)}" aria-selected="false">${esc(labels[key])}</button>`).join("");
  tabs.addEventListener("click", event => { if (event.target.matches("button")) show(event.target.dataset.key); });
  show(entries[0][0]);
}

function renderEvidence(items) {
  document.querySelector("#evidence-grid").innerHTML = items.map(e => `<article class="evidence-card"><header><span class="pill">${esc(e.id)}</span><span class="pill ${e.reliability?.toLowerCase().startsWith("strong") ? "high" : "medium"}">${esc(e.reliability)}</span></header><h3>${esc(e.file)}</h3><p>${esc(e.factEstablished)}</p><small>${esc(e.reference)}${e.conflictingEvidence ? ` · Conflict: ${esc(e.conflictingEvidence)}` : ""}</small></article>`).join("");
}

function renderUncertainties(items) {
  document.querySelector("#uncertainty-grid").innerHTML = items.map(u => `<article class="uncertainty-card"><span class="pill ${u.confidence === "low" ? "low" : "medium"}">${esc(u.confidence)}</span><h3>${esc(u.issue)}</h3><p><strong>Known:</strong> ${esc(u.knownEvidence)}</p><p><strong>Gap:</strong> ${esc(u.missingInformation)}</p><p><strong>Action:</strong> ${esc(u.requiredAction)}</p></article>`).join("");
}

loadSubmission().then(data => {
  document.querySelector("#student-name").textContent = data.student.name;
  document.querySelector("#student-id").textContent = data.student.id;
  document.querySelector("#kpi-revenue").textContent = amount(lineAmount(data.statements.profitAndLoss, "Revenue"));
  document.querySelector("#kpi-profit").textContent = amount(lineAmount(data.statements.profitAndLoss, "Profit before unquantified insurance"));
  document.querySelector("#kpi-cash").textContent = amount(lineAmount(data.statements.cashFlow, "Closing cash"));
  document.querySelector("#kpi-assets").textContent = amount(lineAmount(data.statements.balanceSheet, "Total assets"));
  document.querySelector("#statement-grid").innerHTML = [renderStatement("Profit and loss", data.statements.profitAndLoss), renderStatement("Cash flow", data.statements.cashFlow), renderStatement("Balance sheet", data.statements.balanceSheet)].join("");
  document.querySelector("#accounting-conclusion").textContent = data.statements.accountingConclusion;
  document.querySelector("#reconciliation-list").innerHTML = data.reconciliations.map(r => `<div class="check-item ${r.differenceEUR !== 0 ? "warning" : ""}"><span class="check-icon">${r.differenceEUR === 0 ? "✓" : "!"}</span><div><strong>${esc(r.check)}</strong><small>${esc(r.status)}</small></div><span class="check-value">${amount(r.differenceEUR)}</span></div>`).join("");
  renderDecisions(data);
  renderSchedules(data.schedules);
  renderEvidence(data.evidence);
  renderUncertainties(data.uncertainties);
  document.querySelector("#board-decision").textContent = data.boardRecommendation.decision;
  document.querySelector("#board-actions").innerHTML = data.boardRecommendation.actions.map(a => `<article class="board-action"><strong>${esc(a.area)}</strong><span>${esc(a.recommendation)}</span></article>`).join("");
}).catch(error => {
  document.querySelector("main").innerHTML = `<div class="error-state"><strong>Unable to display the submission.</strong><p>${esc(error.message)}</p></div>`;
});
