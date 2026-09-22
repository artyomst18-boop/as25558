const euro = new Intl.NumberFormat("en-IE", { style: "currency", currency: "EUR", maximumFractionDigits: 0 });
const amount = value => value === null || value === "" ? "—" : euro.format(value);
const esc = value => String(value ?? "").replace(/[&<>'"]/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;","'":"&#39;",'"':"&quot;"}[c]));
const disagreementIds = new Set(["D075", "D091", "D100"]);
const uncertaintyIds = new Set(["D048", "D056", "D060", "D074", "D075", "D078", "D091", "D100"]);

fetch("/submission.json", { cache: "no-store" }).then(response => {
  if (!response.ok) throw new Error("The submission data could not be loaded.");
  return response.json();
}).then(data => {
  const material = data.decisions.filter(d => d.reviewTier === "material_judgment");
  const lowConfidence = data.decisions.filter(d => d.confidence === "low");
  const summary = document.querySelector("#review-summary");
  summary.innerHTML = `<div class="summary-chip"><strong>${material.length}</strong><span>material judgments</span></div><div class="summary-chip"><strong>${material.filter(d => d.status === "Certified").length}</strong><span>student certified</span></div><div class="summary-chip"><strong>${material.filter(d => d.changedFromAI).length}</strong><span>student overrides</span></div><div class="summary-chip"><strong>${lowConfidence.length}</strong><span>low-confidence decisions</span></div>`;
  document.querySelector("#review-alerts").innerHTML = `<article class="review-alert"><strong>Agent difference</strong><span>Inventory measurement creates a €9,000 profit and asset sensitivity.</span></article><article class="review-alert"><strong>Evidence gap</strong><span>Insurance cannot be quantified from the supplied files.</span></article><article class="review-alert"><strong>Valuation caution</strong><span>Reviewed profit is €74,000, not management's €312,000 claim.</span></article>`;
  document.querySelector("#low-confidence-list").innerHTML = lowConfidence.map(d => `<article class="low-confidence-item"><strong>${esc(d.id)}</strong><span>${esc(d.question)}</span></article>`).join("");
  const list = document.querySelector("#review-list");
  const search = document.querySelector("#review-search");
  const filter = document.querySelector("#review-filter");
  const count = document.querySelector("#review-count");
  function flags(d) {
    return {
      disagreement: disagreementIds.has(d.id), override: d.changedFromAI,
      uncertainty: uncertaintyIds.has(d.id) || Boolean(d.notes),
    };
  }
  function draw() {
    const term = search.value.trim().toLowerCase();
    const mode = filter.value;
    const visible = material.filter(d => {
      const matches = [d.id, d.question, d.answer, d.aiProposal, d.independentChallenge, d.studentReasoning].join(" ").toLowerCase().includes(term);
      return matches && (mode === "all" || flags(d)[mode]);
    });
    count.textContent = `Showing ${visible.length} of ${material.length} material judgments`;
    list.innerHTML = visible.map(d => {
      const f = flags(d);
      const tags = [`<span class="pill ${d.confidence}">${esc(d.confidence)} confidence</span>`, `<span class="pill high">${esc(d.status)}</span>`];
      if (f.disagreement) tags.push(`<span class="pill material">Agent difference</span>`);
      if (f.override) tags.push(`<span class="pill material">Student override</span>`);
      if (f.uncertainty) tags.push(`<span class="pill medium">Uncertainty</span>`);
      return `<article class="judgment"><header class="judgment-header"><h2>${esc(d.id)} · ${esc(d.question)}</h2><div class="judgment-tags">${tags.join("")}</div></header><div class="judgment-body"><section class="position"><h3>Agent 1 proposal</h3><p>${esc(d.aiProposal)}</p></section><section class="position"><h3>Independent Agent 2 challenge</h3><p>${esc(d.independentChallenge)}</p></section><section class="position"><h3>Certified answer and reasoning</h3><p><strong>${esc(d.answer)}</strong></p><p>${esc(d.studentReasoning)}</p></section></div><footer class="judgment-footer"><div><div class="effect-row">${Object.entries(d.statementEffect).map(([key,value]) => `<span class="effect">${esc(key)}: ${amount(value)}</span>`).join("")}</div>${d.notes ? `<p class="evidence-line">Unresolved: ${esc(d.notes)}</p>` : ""}</div><div class="evidence-line"><strong>Evidence:</strong> ${d.evidence.map(esc).join(" · ")}</div></footer></article>`;
    }).join("");
  }
  search.addEventListener("input", draw);
  filter.addEventListener("change", draw);
  draw();
}).catch(error => {
  document.querySelector("main").innerHTML = `<div class="error-state"><strong>Unable to display the review trail.</strong><p>${esc(error.message)}</p></div>`;
});
