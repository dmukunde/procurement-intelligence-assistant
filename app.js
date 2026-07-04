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

const SAMPLE_SUPPLIERS = [
  {
    name: "Nordex Manufacturing Ltd.",
    price: "142500",
    delivery: "21",
    warranty: "18",
    risk: "ISO 9001 certified. Stable financials. Minor delivery variance reported in Q3."
  },
  {
    name: "Apex Supply Group",
    price: "128900",
    delivery: "28",
    warranty: "12",
    risk: "Competitive pricing, but prior late shipments and quality concerns on two orders."
  },
  {
    name: "Horizon Industrial Partners",
    price: "155000",
    delivery: "14",
    warranty: "36",
    risk: "Premium vendor with strong compliance record and dedicated account support."
  }
];

let form;
let resultsSection;
let formError;
let fillSampleBtn;

document.addEventListener("DOMContentLoaded", initApp);

function initApp() {
  form = document.getElementById("supplier-form");
  resultsSection = document.getElementById("results");
  formError = document.getElementById("form-error");
  fillSampleBtn = document.getElementById("fill-sample-btn");

  if (!form || !fillSampleBtn) {
    console.error("Procurement app failed to initialize: required elements were not found.");
    return;
  }

  fillSampleBtn.addEventListener("click", loadSampleData);
  form.addEventListener("submit", handleSubmit);
}

function getField(name) {
  return form.querySelector(`[name="${name}"]`);
}

function loadSampleData() {
  hideError();

  for (let index = 0; index < SAMPLE_SUPPLIERS.length; index++) {
    const sample = SAMPLE_SUPPLIERS[index];
    const i = index + 1;
    const nameField = getField(`name-${i}`);
    const priceField = getField(`price-${i}`);
    const deliveryField = getField(`delivery-${i}`);
    const warrantyField = getField(`warranty-${i}`);
    const riskField = getField(`risk-${i}`);

    if (!nameField || !priceField || !deliveryField || !warrantyField || !riskField) {
      showError(`Could not find all input fields for Supplier ${i}.`);
      return;
    }

    nameField.value = sample.name;
    priceField.value = sample.price;
    deliveryField.value = sample.delivery;
    warrantyField.value = sample.warranty;
    riskField.value = sample.risk;
  }

  runComparison({ scrollToResults: true });
}

function handleSubmit(event) {
  event.preventDefault();
  runComparison({ scrollToResults: true });
}

function runComparison(options = {}) {
  hideError();

  const suppliers = collectSuppliers();
  if (!suppliers) {
    return;
  }

  const scored = scoreSuppliers(suppliers);
  renderResults(scored, options.scrollToResults);
}

function collectSuppliers() {
  const suppliers = [];

  for (let i = 1; i <= 3; i++) {
    const nameField = getField(`name-${i}`);
    const priceField = getField(`price-${i}`);
    const deliveryField = getField(`delivery-${i}`);
    const warrantyField = getField(`warranty-${i}`);
    const riskField = getField(`risk-${i}`);

    if (!nameField || !priceField || !deliveryField || !warrantyField || !riskField) {
      showError(`Could not read input fields for Supplier ${i}.`);
      return null;
    }

    const name = nameField.value.trim();
    const price = parseFloat(priceField.value);
    const delivery = parseInt(deliveryField.value, 10);
    const warranty = parseInt(warrantyField.value, 10);
    const riskNotes = riskField.value.trim();

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

function updateKpiCards(suppliers) {
  const avgPrice = suppliers.reduce((sum, s) => sum + s.price, 0) / suppliers.length;
  const fastestDelivery = Math.min(...suppliers.map((s) => s.delivery));
  const highestWarranty = Math.max(...suppliers.map((s) => s.warranty));

  document.getElementById("kpi-suppliers").textContent = suppliers.length;
  document.getElementById("kpi-avg-price").textContent = formatCurrency(avgPrice);
  document.getElementById("kpi-fastest-delivery").textContent = `${fastestDelivery} days`;
  document.getElementById("kpi-highest-warranty").textContent = `${highestWarranty} months`;
}

function renderResults(scoredSuppliers, scrollToResults = false) {
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

  updateKpiCards(scoredSuppliers);
  renderSupplierIntelligence(best, scoredSuppliers);

  resultsSection.hidden = false;

  if (scrollToResults) {
    resultsSection.scrollIntoView({ behavior: "smooth", block: "start" });
  }
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

const FINANCIAL_KEYWORDS = [
  "bankruptcy", "lawsuit", "penalty", "shortage", "unstable", "uncertain"
];

const DELIVERY_KEYWORDS = [
  "delay", "delayed", "late", "unreliable", "shortage"
];

function assessLevel(score) {
  if (score >= 70) {
    return { level: "Low", indicator: "green" };
  }
  if (score >= 40) {
    return { level: "Medium", indicator: "yellow" };
  }
  return { level: "High", indicator: "red" };
}

function assessFinancialRisk(supplier) {
  let score = 100;

  if (supplier.risk.flagged) {
    score -= 40;
  } else if (supplier.risk.hasConcerns) {
    score -= 20;
  }

  const lowerNotes = supplier.riskNotes.toLowerCase();
  if (FINANCIAL_KEYWORDS.some((keyword) => lowerNotes.includes(keyword))) {
    score -= 30;
  }

  return assessLevel(score);
}

function assessDeliveryReliability(supplier, all) {
  const fastest = Math.min(...all.map((s) => s.delivery));
  const slowest = Math.max(...all.map((s) => s.delivery));
  let score = normalizeScore(supplier.delivery, fastest, slowest, false);

  const lowerNotes = supplier.riskNotes.toLowerCase();
  if (DELIVERY_KEYWORDS.some((keyword) => lowerNotes.includes(keyword))) {
    score -= 25;
  }

  if (supplier.risk.flagged) {
    score -= 15;
  }

  score = Math.max(0, score);

  const reliability = assessLevel(score);
  return {
    level: score >= 70 ? "High" : score >= 40 ? "Medium" : "Low",
    indicator: score >= 70 ? "green" : score >= 40 ? "yellow" : "red"
  };
}

function assessNegotiationOpportunity(supplier, all) {
  const lowestPrice = Math.min(...all.map((s) => s.price));
  const longestWarranty = Math.max(...all.map((s) => s.warranty));
  const fastestDelivery = Math.min(...all.map((s) => s.delivery));

  let score = 0;

  if (supplier.price > lowestPrice) {
    score += 35;
  }
  if (supplier.warranty < longestWarranty) {
    score += 35;
  }
  if (supplier.delivery > fastestDelivery) {
    score += 30;
  }

  return {
    level: score >= 60 ? "High" : score >= 30 ? "Medium" : "Low",
    indicator: score >= 60 ? "green" : score >= 30 ? "yellow" : "red"
  };
}

function getPaymentTerms(financialRisk) {
  if (financialRisk.level === "Low") {
    return "Net 30";
  }
  if (financialRisk.level === "Medium") {
    return "Net 15";
  }
  return "Net 10";
}

function buildNegotiationPoints(supplier, all) {
  const points = [];
  const lowestPrice = Math.min(...all.map((s) => s.price));
  const longestWarranty = Math.max(...all.map((s) => s.warranty));
  const fastestDelivery = Math.min(...all.map((s) => s.delivery));

  if (supplier.price > lowestPrice) {
    points.push("Request 2% early payment discount.");
  }

  if (supplier.warranty < longestWarranty) {
    const extension = longestWarranty - supplier.warranty;
    points.push(`Ask for ${extension}-month warranty extension.`);
  }

  if (supplier.delivery > fastestDelivery) {
    const targetDays = Math.max(fastestDelivery, supplier.delivery - 3);
    points.push(`Negotiate delivery from ${supplier.delivery} days to ${targetDays} days.`);
  }

  if (points.length === 0) {
    points.push("Confirm pricing holds for 90 days.");
    points.push("Request dedicated account manager for order tracking.");
    points.push("Include service-level penalties for delivery delays.");
  }

  return points;
}

function renderMetricIndicator(elementId, assessment, invertHighIsGood) {
  const element = document.getElementById(elementId);
  const isPositive = invertHighIsGood
    ? assessment.level === "High"
    : assessment.level === "Low";

  const indicatorClass = assessment.indicator === "green"
    ? "status--green"
    : assessment.indicator === "yellow"
      ? "status--yellow"
      : "status--red";

  element.innerHTML = `
    <span class="status-dot ${indicatorClass}" aria-hidden="true"></span>
    <span>${assessment.level}</span>
  `;
  element.className = `intelligence-metric__value ${isPositive ? "intelligence-metric__value--positive" : ""}`;
}

function renderSupplierIntelligence(supplier, all) {
  const financialRisk = assessFinancialRisk(supplier);
  const deliveryReliability = assessDeliveryReliability(supplier, all);
  const negotiationOpportunity = assessNegotiationOpportunity(supplier, all);
  const paymentTerms = getPaymentTerms(financialRisk);
  const negotiationPoints = buildNegotiationPoints(supplier, all);

  renderMetricIndicator("intel-financial-risk", financialRisk, false);
  renderMetricIndicator("intel-delivery-reliability", deliveryReliability, true);

  const negotiationElement = document.getElementById("intel-negotiation-opportunity");
  const negIndicatorClass = negotiationOpportunity.indicator === "green"
    ? "status--green"
    : negotiationOpportunity.indicator === "yellow"
      ? "status--yellow"
      : "status--red";

  negotiationElement.innerHTML = `
    <span class="status-dot ${negIndicatorClass}" aria-hidden="true"></span>
    <span>${negotiationOpportunity.level}</span>
  `;
  negotiationElement.className = "intelligence-metric__value intelligence-metric__value--positive";

  document.getElementById("intel-payment-terms").textContent = paymentTerms;

  const listElement = document.getElementById("intel-negotiation-points");
  listElement.innerHTML = negotiationPoints
    .map((point) => `<li>${escapeHtml(point)}</li>`)
    .join("");
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
