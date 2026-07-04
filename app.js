const CONCERNING_KEYWORDS = [
  "delay", "delayed", "late", "risk", "concern", "issue", "unreliable",
  "quality", "defect", "failure", "breach", "compliance", "penalty",
  "shortage", "bankruptcy", "lawsuit", "dispute", "recall", "violation",
  "unstable", "uncertain", "warning", "problem", "critical", "severe"
];

const RISK_LENGTH_THRESHOLD = 80;
const RISK_WORD_THRESHOLD = 12;
const RISK_PENALTY = 15;

const WEIGHTS = {
  price: 0.4,
  delivery: 0.3,
  warranty: 0.2,
  risk: 0.1
};

const form = document.getElementById("supplier-form");
const resultsSection = document.getElementById("results");
const formError = document.getElementById("form-error");
const fillSampleBtn = document.getElementById("fill-sample-btn");

fillSampleBtn.addEventListener("click", loadSampleData);
form.addEventListener("submit", handleSubmit);

function loadSampleData() {
  const samples = [
    {
      name: "Acme Industrial",
      price: "24500",
      delivery: "18",
      warranty: "24",
      risk: "Stable track record. Minor past delivery variance in Q4."
    },
    {
      name: "Global Parts Co.",
      price: "22800",
      delivery: "25",
      warranty: "12",
      risk: "Lower price but history of late shipments and quality concerns on prior orders."
    },
    {
      name: "Prime Logistics Ltd.",
      price: "26100",
      delivery: "12",
      warranty: "36",
      risk: "Premium vendor with strong compliance record."
    }
  ];

  samples.forEach((sample, index) => {
    const i = index + 1;
    form.elements[`name-${i}`].value = sample.name;
    form.elements[`price-${i}`].value = sample.price;
    form.elements[`delivery-${i}`].value = sample.delivery;
    form.elements[`warranty-${i}`].value = sample.warranty;
    form.elements[`risk-${i}`].value = sample.risk;
  });

  hideError();
}

function handleSubmit(event) {
  event.preventDefault();
  hideError();

  const suppliers = collectSuppliers();

  if (!suppliers) {
    return;
  }

  const scored = scoreSuppliers(suppliers);
  renderResults(scored);
}

function collectSuppliers() {
  const suppliers = [];

  for (let i = 1; i <= 3; i++) {
    const name = form.elements[`name-${i}`].value.trim();
    const price = parseFloat(form.elements[`price-${i}`].value);
    const delivery = parseInt(form.elements[`delivery-${i}`].value, 10);
    const warranty = parseInt(form.elements[`warranty-${i}`].value, 10);
    const riskNotes = form.elements[`risk-${i}`].value.trim();

    if (!name) {
      showError(`Please enter a name for Supplier ${i}.`);
      return null;
    }

    if (Number.isNaN(price) || price < 0) {
      showError(`Please enter a valid price for ${name}.`);
      return null;
    }

    if (Number.isNaN(delivery) || delivery < 1) {
      showError(`Please enter a valid delivery time (at least 1 day) for ${name}.`);
      return null;
    }

    if (Number.isNaN(warranty) || warranty < 0) {
      showError(`Please enter a valid warranty period for ${name}.`);
      return null;
    }

    suppliers.push({ name, price, delivery, warranty, riskNotes });
  }

  const names = suppliers.map((s) => s.name.toLowerCase());
  if (new Set(names).size !== names.length) {
    showError("Each supplier must have a unique name.");
    return null;
  }

  return suppliers;
}

function analyzeRisk(riskNotes) {
  const notes = riskNotes.trim();
  const wordCount = notes ? notes.split(/\s+/).length : 0;
  const lowerNotes = notes.toLowerCase();

  const matchedKeywords = CONCERNING_KEYWORDS.filter((keyword) =>
    lowerNotes.includes(keyword)
  );

  const isLong = notes.length >= RISK_LENGTH_THRESHOLD || wordCount >= RISK_WORD_THRESHOLD;
  const hasConcerns = matchedKeywords.length > 0;
  const flagged = isLong || hasConcerns;

  return {
    flagged,
    isLong,
    hasConcerns,
    matchedKeywords,
    summary: flagged
      ? isLong && hasConcerns
        ? "Flagged — lengthy & concerning"
        : hasConcerns
          ? "Flagged — concerning terms"
          : "Flagged — lengthy notes"
      : "Clear"
  };
}

function normalizeScore(value, min, max, higherIsBetter) {
  if (max === min) {
    return 100;
  }

  const ratio = higherIsBetter
    ? (value - min) / (max - min)
    : (max - value) / (max - min);

  return Math.round(ratio * 100);
}

function scoreSuppliers(suppliers) {
  const prices = suppliers.map((s) => s.price);
  const deliveries = suppliers.map((s) => s.delivery);
  const warranties = suppliers.map((s) => s.warranty);

  const minPrice = Math.min(...prices);
  const maxPrice = Math.max(...prices);
  const minDelivery = Math.min(...deliveries);
  const maxDelivery = Math.max(...deliveries);
  const minWarranty = Math.min(...warranties);
  const maxWarranty = Math.max(...warranties);

  return suppliers.map((supplier) => {
    const risk = analyzeRisk(supplier.riskNotes);

    const priceScore = normalizeScore(supplier.price, minPrice, maxPrice, false);
    const deliveryScore = normalizeScore(supplier.delivery, minDelivery, maxDelivery, false);
    const warrantyScore = normalizeScore(supplier.warranty, minWarranty, maxWarranty, true);
    const riskScore = risk.flagged ? 0 : risk.hasConcerns ? 50 : 100;

    let totalScore =
      priceScore * WEIGHTS.price +
      deliveryScore * WEIGHTS.delivery +
      warrantyScore * WEIGHTS.warranty +
      riskScore * WEIGHTS.risk;

    if (risk.flagged) {
      totalScore = Math.max(0, totalScore - RISK_PENALTY);
    }

    return {
      ...supplier,
      risk,
      scores: {
        price: priceScore,
        delivery: deliveryScore,
        warranty: warrantyScore,
        risk: riskScore,
        total: Math.round(totalScore)
      }
    };
  }).sort((a, b) => b.scores.total - a.scores.total);
}

function formatCurrency(amount) {
  return new Intl.NumberFormat("en-US", {
    style: "currency",
    currency: "USD",
    maximumFractionDigits: 0
  }).format(amount);
}

function renderResults(scoredSuppliers) {
  const tbody = document.querySelector("#comparison-table tbody");
  tbody.innerHTML = "";

  const best = scoredSuppliers[0];

  scoredSuppliers.forEach((supplier) => {
    const row = document.createElement("tr");
    if (supplier.name === best.name) {
      row.classList.add("best-row");
    }

    const riskBadgeClass = supplier.risk.flagged ? "badge--flag" : "badge--ok";

    row.innerHTML = `
      <td><strong>${escapeHtml(supplier.name)}</strong></td>
      <td>${formatCurrency(supplier.price)}</td>
      <td>${supplier.delivery} days</td>
      <td>${supplier.warranty} months</td>
      <td><span class="badge ${riskBadgeClass}">${escapeHtml(supplier.risk.summary)}</span></td>
      <td class="score-cell">${supplier.scores.total}/100</td>
    `;

    tbody.appendChild(row);
  });

  document.getElementById("recommended-supplier").textContent = best.name;
  document.getElementById("recommendation-reason").textContent = buildRecommendationReason(best, scoredSuppliers);
  document.getElementById("executive-summary").textContent = buildExecutiveSummary(best, scoredSuppliers);

  resultsSection.hidden = false;
  resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
}

function buildRecommendationReason(best, all) {
  const strengths = [];

  const lowestPrice = Math.min(...all.map((s) => s.price));
  const shortestDelivery = Math.min(...all.map((s) => s.delivery));
  const longestWarranty = Math.max(...all.map((s) => s.warranty));

  if (best.price === lowestPrice) {
    strengths.push("the most competitive price");
  }
  if (best.delivery === shortestDelivery) {
    strengths.push("the shortest delivery timeline");
  }
  if (best.warranty === longestWarranty) {
    strengths.push("the strongest warranty coverage");
  }
  if (!best.risk.flagged) {
    strengths.push("acceptable risk profile");
  }

  const strengthText = strengths.length
    ? strengths.join(", ")
    : "the strongest overall weighted score";

  return `Selected based on ${strengthText} (overall score: ${best.scores.total}/100).`;
}

function buildExecutiveSummary(best, all) {
  const sortedByPrice = [...all].sort((a, b) => a.price - b.price);
  const sortedByDelivery = [...all].sort((a, b) => a.delivery - b.delivery);
  const flagged = all.filter((s) => s.risk.flagged);

  const cheapest = sortedByPrice[0];
  const fastest = sortedByDelivery[0];

  let summary = `After evaluating three supplier proposals, ${best.name} is recommended for award. `;
  summary += `This supplier achieved the highest composite score (${best.scores.total}/100), balancing cost at ${formatCurrency(best.price)}, `;
  summary += `a ${best.delivery}-day delivery window, and a ${best.warranty}-month warranty. `;

  if (cheapest.name !== best.name) {
    summary += `Although ${cheapest.name} offered a lower price (${formatCurrency(cheapest.price)}), `;
    summary += `the total value proposition favors ${best.name} when delivery, warranty, and risk factors are considered. `;
  }

  if (fastest.name !== best.name && fastest.delivery < best.delivery) {
    summary += `${fastest.name} can deliver sooner (${fastest.delivery} days), but does not outperform on overall procurement criteria. `;
  }

  if (flagged.length > 0) {
    const flaggedNames = flagged.map((s) => s.name).join(" and ");
    summary += `Procurement should exercise additional due diligence on ${flaggedNames}, where risk notes warrant further review before contract execution. `;
  } else {
    summary += "No suppliers were flagged for critical risk concerns based on the submitted notes. ";
  }

  summary += `Next steps: confirm final pricing, validate delivery commitments in writing, and proceed with standard vendor onboarding for ${best.name}.`;

  return summary;
}

function showError(message) {
  formError.textContent = message;
  formError.hidden = false;
}

function hideError() {
  formError.hidden = true;
  formError.textContent = "";
}

function escapeHtml(text) {
  const div = document.createElement("div");
  div.textContent = text;
  return div.innerHTML;
}
