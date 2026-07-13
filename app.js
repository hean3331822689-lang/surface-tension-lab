const STORAGE_KEY = "surface-tension-lab-v4";

const sampleParams = {
  rho: "1000",
  gravity: "9.80",
  instrumentK: "314.29",
  frameWidth: "0.036",
  filmThickness: "0.00014",
  coverageFactorInput: "2",
  deltaU1: "0.01",
  deltaU2: "0.01",
  deltaH: "0.00001",
};

const sampleRows = [
  { u1: "1.69", u2: "0.04", h: "0.00381" },
  { u1: "1.75", u2: "0.11", h: "0.00382" },
  { u1: "1.44", u2: "-0.19", h: "0.00337" },
  { u1: "1.52", u2: "-0.16", h: "0.00348" },
  { u1: "1.71", u2: "0", h: "0.00416" },
  { u1: "1.71", u2: "0", h: "0.00339" },
  { u1: "1.44", u2: "-0.22", h: "0.00351" },
  { u1: "1.53", u2: "-0.14", h: "0.00348" },
  { u1: "1.60", u2: "-0.06", h: "0.00376" },
  { u1: "1.77", u2: "0.04", h: "0.00335" },
  { u1: "1.54", u2: "-0.11", h: "0.00336" },
];

const blankRows = Array.from({ length: 6 }, () => ({ u1: "", u2: "", h: "" }));
const paramIds = Object.keys(sampleParams);
let rows = structuredClone(sampleRows);

const $ = (id) => document.getElementById(id);

function numberFromInput(id, fallback = 0) {
  const value = Number($(id).value);
  return Number.isFinite(value) ? value : fallback;
}

function parseMaybeNumber(value) {
  const parsed = Number(String(value).trim());
  return Number.isFinite(parsed) ? parsed : NaN;
}

function square(value) {
  return value * value;
}

function safeSqrt(value) {
  return Math.sqrt(Math.max(0, value));
}

function mean(values) {
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function formatNumber(value, digits = 6) {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.0001)) {
    return value.toExponential(4);
  }
  return value.toFixed(digits);
}

function formatVoltage(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value, 5)} mV`;
}

function formatLength(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value, 6)} m`;
}

function formatGamma(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value, 6)} N/m`;
}

function formatGammaCompact(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value, 4)} N/m`;
}

function formatInterval(meanValue, expanded) {
  if (!Number.isFinite(meanValue) || !Number.isFinite(expanded)) return "等待有效数据";
  return `[${formatGamma(meanValue - expanded)}, ${formatGamma(meanValue + expanded)}]`;
}

function getParams() {
  return {
    rho: numberFromInput("rho"),
    gravity: numberFromInput("gravity"),
    instrumentK: numberFromInput("instrumentK"),
    frameWidth: numberFromInput("frameWidth"),
    filmThickness: numberFromInput("filmThickness"),
    coverageFactor: numberFromInput("coverageFactorInput", 2),
    deltaU1: Math.abs(numberFromInput("deltaU1")),
    deltaU2: Math.abs(numberFromInput("deltaU2")),
    deltaH: Math.abs(numberFromInput("deltaH")),
  };
}

function getValidRows() {
  return rows
    .map((row, index) => ({
      rowIndex: index,
      u1: parseMaybeNumber(row.u1),
      u2: parseMaybeNumber(row.u2),
      h: parseMaybeNumber(row.h),
    }))
    .filter((row) => Number.isFinite(row.u1) && Number.isFinite(row.u2) && Number.isFinite(row.h));
}

function gammaValue(params, u1, u2, h) {
  return (
    (u1 - u2) / (2 * params.instrumentK * params.frameWidth) -
    (params.rho * params.gravity * params.filmThickness * h) / 2
  );
}

function uA(values) {
  const n = values.length;
  if (n < 2) return NaN;
  const avg = mean(values);
  const sumSq = values.reduce((sum, value) => sum + square(value - avg), 0);
  return Math.sqrt(sumSq / (n * (n - 1)));
}

function uB(instrumentDivision) {
  return instrumentDivision / Math.sqrt(3);
}

function uCombine(values, instrumentDivision) {
  const typeA = uA(values);
  const typeB = uB(instrumentDivision);
  return safeSqrt(square(typeA) + square(typeB));
}

function calculate() {
  const params = getParams();
  const validRows = getValidRows();

  if (
    validRows.length < 2 ||
    params.instrumentK <= 0 ||
    params.frameWidth <= 0 ||
    !Number.isFinite(params.filmThickness)
  ) {
    return invalidCalculation(params, validRows);
  }

  const u1Values = validRows.map((row) => row.u1);
  const u2Values = validRows.map((row) => row.u2);
  const hValues = validRows.map((row) => row.h);
  const u1Average = mean(u1Values);
  const u2Average = mean(u2Values);
  const hAverage = mean(hValues);
  const gammaAverage = gammaValue(params, u1Average, u2Average, hAverage);

  const uA1 = uA(u1Values);
  const uB1 = uB(params.deltaU1);
  const uU1 = uCombine(u1Values, params.deltaU1);
  const uA2 = uA(u2Values);
  const uB2 = uB(params.deltaU2);
  const uU2 = uCombine(u2Values, params.deltaU2);
  const uAh = uA(hValues);
  const uBh = uB(params.deltaH);
  const uH = uCombine(hValues, params.deltaH);

  const partialU1 = 1 / (2 * params.instrumentK * params.frameWidth);
  const partialU2 = -1 / (2 * params.instrumentK * params.frameWidth);
  const partialH = -(params.rho * params.gravity * params.filmThickness) / 2;
  const standardGammaUncertainty = safeSqrt(
    square(partialU1 * uU1) + square(partialU2 * uU2) + square(partialH * uH),
  );
  const expandedGammaUncertainty = params.coverageFactor * standardGammaUncertainty;

  return {
    params,
    validRows,
    u1Average,
    u2Average,
    hAverage,
    gammaAverage,
    uA1,
    uB1,
    uU1,
    uA2,
    uB2,
    uU2,
    uAh,
    uBh,
    uH,
    partialU1,
    partialU2,
    partialH,
    standardGammaUncertainty,
    expandedGammaUncertainty,
    rowGammas: new Map(
      validRows.map((row) => [row.rowIndex, gammaValue(params, row.u1, row.u2, row.h)]),
    ),
    formula: "γ = (U1 - U2)/(2KL) - ρgdh/2",
  };
}

function invalidCalculation(params, validRows) {
  return {
    params,
    validRows,
    u1Average: NaN,
    u2Average: NaN,
    hAverage: NaN,
    gammaAverage: NaN,
    uA1: NaN,
    uB1: Number.isFinite(params.deltaU1) ? uB(params.deltaU1) : NaN,
    uU1: NaN,
    uA2: NaN,
    uB2: Number.isFinite(params.deltaU2) ? uB(params.deltaU2) : NaN,
    uU2: NaN,
    uAh: NaN,
    uBh: Number.isFinite(params.deltaH) ? uB(params.deltaH) : NaN,
    uH: NaN,
    partialU1: NaN,
    partialU2: NaN,
    partialH: NaN,
    standardGammaUncertainty: NaN,
    expandedGammaUncertainty: NaN,
    rowGammas: new Map(),
    formula: "γ = (U1 - U2)/(2KL) - ρgdh/2",
  };
}

function renderRows(result) {
  const body = $("measurementBody");
  body.innerHTML = rows
    .map(
      (row, index) => `
        <tr data-row="${index}">
          <td>${index + 1}</td>
          <td>
            <input type="number" step="0.001" value="${row.u1}" data-field="u1" data-index="${index}" aria-label="第${index + 1}行 U1" />
          </td>
          <td>
            <input type="number" step="0.001" value="${row.u2}" data-field="u2" data-index="${index}" aria-label="第${index + 1}行 U2" />
          </td>
          <td>
            <input type="number" step="0.00001" value="${row.h}" data-field="h" data-index="${index}" aria-label="第${index + 1}行 h" />
          </td>
          <td class="force-cell">${formatNumber(result.rowGammas.get(index), 6)}</td>
          <td><button class="row-delete" data-delete="${index}" aria-label="删除第${index + 1}行">×</button></td>
        </tr>
      `,
    )
    .join("");

  body.querySelectorAll("input").forEach((input) => {
    input.addEventListener("input", (event) => {
      const target = event.target;
      rows[Number(target.dataset.index)][target.dataset.field] = target.value;
      calculateAndRender();
      persistState();
    });
  });

  body.querySelectorAll("[data-delete]").forEach((button) => {
    button.addEventListener("click", () => {
      rows.splice(Number(button.dataset.delete), 1);
      if (!rows.length) rows.push({ u1: "", u2: "", h: "" });
      calculateAndRender();
      persistState();
    });
  });
}

function updateText(result) {
  const { params } = result;
  const finalText =
    Number.isFinite(result.gammaAverage) && Number.isFinite(result.expandedGammaUncertainty)
      ? `${formatGamma(result.gammaAverage)} ± ${formatGamma(result.expandedGammaUncertainty)}`
      : "--";
  const intervalText =
    Number.isFinite(result.gammaAverage) && Number.isFinite(result.expandedGammaUncertainty)
      ? `置信区间：${formatInterval(result.gammaAverage, result.expandedGammaUncertainty)}`
      : "等待有效数据";

  $("centerGamma").textContent = finalText;
  $("centerInterval").textContent = intervalText;
  $("finalGamma").textContent = finalText;
  $("finalInterval").textContent = intervalText;
  $("u1Average").textContent = formatVoltage(result.u1Average);
  $("u2Average").textContent = formatVoltage(result.u2Average);
  $("hAverage").textContent = formatLength(result.hAverage);
  $("standardGammaUncertainty").textContent = formatGamma(result.standardGammaUncertainty);
  $("expandedGammaUncertainty").textContent = formatGamma(result.expandedGammaUncertainty);
  $("repeatCount").textContent = result.validRows.length ? String(result.validRows.length) : "--";
  $("formulaText").textContent = result.formula;
  $("centerFormula").textContent = result.formula;

  $("uA1").textContent = formatVoltage(result.uA1);
  $("uB1").textContent = formatVoltage(result.uB1);
  $("uU1").textContent = formatVoltage(result.uU1);
  $("uA2").textContent = formatVoltage(result.uA2);
  $("uB2").textContent = formatVoltage(result.uB2);
  $("uU2").textContent = formatVoltage(result.uU2);
  $("uAh").textContent = formatLength(result.uAh);
  $("uBh").textContent = formatLength(result.uBh);
  $("uH").textContent = formatLength(result.uH);
  $("partialU1").textContent = formatNumber(result.partialU1, 8);
  $("partialU2").textContent = formatNumber(result.partialU2, 8);
  $("partialH").textContent = formatNumber(result.partialH, 6);
  $("kpValue").textContent = formatNumber(params.coverageFactor, 3);
}

function renderCalculationSteps(result) {
  const steps = [
    `U1 平均值 = ${formatVoltage(result.u1Average)}，U2 平均值 = ${formatVoltage(result.u2Average)}，h 平均值 = ${formatLength(result.hAverage)}`,
    `u(U1) = √[uA(U1)² + uB(U1)²] = ${formatVoltage(result.uU1)}`,
    `u(U2) = √[uA(U2)² + uB(U2)²] = ${formatVoltage(result.uU2)}`,
    `u(h) = √[uA(h)² + uB(h)²] = ${formatLength(result.uH)}`,
    `∂γ/∂U1 = ${formatNumber(result.partialU1, 8)}，∂γ/∂U2 = ${formatNumber(result.partialU2, 8)}，∂γ/∂h = ${formatNumber(result.partialH, 6)}`,
    `uγ = √[(∂γ/∂U1·uU1)² + (∂γ/∂U2·uU2)² + (∂γ/∂h·uh)²] = ${formatGamma(result.standardGammaUncertainty)}`,
    `Uγ = kp·uγ = ${formatGamma(result.expandedGammaUncertainty)}`,
  ];
  $("calculationSteps").innerHTML = steps.map((step) => `<li>${step}</li>`).join("");
}

function renderReport(result) {
  const { params } = result;
  $("reportContent").innerHTML = `
    <article class="report-block">
      <h3>实验常数</h3>
      <table class="mini-table">
        <tbody>
          <tr><td>ρ</td><td>${formatNumber(params.rho, 2)} kg/m³</td></tr>
          <tr><td>g</td><td>${formatNumber(params.gravity, 2)} m/s²</td></tr>
          <tr><td>K</td><td>${formatNumber(params.instrumentK, 2)} mV/N</td></tr>
          <tr><td>L</td><td>${formatNumber(params.frameWidth, 6)} m</td></tr>
          <tr><td>d</td><td>${formatNumber(params.filmThickness, 6)} m</td></tr>
          <tr><td>kp</td><td>${formatNumber(params.coverageFactor, 3)}</td></tr>
        </tbody>
      </table>
    </article>
    <article class="report-block">
      <h3>平均读数</h3>
      <ul>
        <li>U1avg = ${formatVoltage(result.u1Average)}</li>
        <li>U2avg = ${formatVoltage(result.u2Average)}</li>
        <li>havg = ${formatLength(result.hAverage)}</li>
        <li>n = ${result.validRows.length || "--"}</li>
      </ul>
    </article>
    <article class="report-block">
      <h3>合成标准不确定度</h3>
      <ul>
        <li>u(U1) = ${formatVoltage(result.uU1)}</li>
        <li>u(U2) = ${formatVoltage(result.uU2)}</li>
        <li>u(h) = ${formatLength(result.uH)}</li>
        <li>uγ = ${formatGamma(result.standardGammaUncertainty)}</li>
      </ul>
    </article>
    <article class="report-block">
      <h3>最终结果</h3>
      <ul>
        <li>γ平均值 = ${formatGamma(result.gammaAverage)}</li>
        <li>Uγ(P=0.95) = ${formatGamma(result.expandedGammaUncertainty)}</li>
        <li>γ = (${formatGammaCompact(result.gammaAverage)} ± ${formatGammaCompact(result.expandedGammaUncertainty)})</li>
      </ul>
    </article>
    <article class="report-block wide">
      <h3>公式与偏导</h3>
      <ul>
        <li>γ = (U1 - U2)/(2KL) - ρgdh/2</li>
        <li>∂γ/∂U1 = ${formatNumber(result.partialU1, 8)}</li>
        <li>∂γ/∂U2 = ${formatNumber(result.partialU2, 8)}</li>
        <li>∂γ/∂h = ${formatNumber(result.partialH, 6)}</li>
      </ul>
    </article>
    <article class="report-block wide">
      <h3>实验结论</h3>
      <p>
        按 A 类、B 类不确定度合成并进行偏导传播，最终表面张力系数为
        <strong>${formatGamma(result.gammaAverage)} ± ${formatGamma(result.expandedGammaUncertainty)}</strong>，
        置信水平按 kp = ${formatNumber(params.coverageFactor, 3)} 处理。
      </p>
    </article>
  `;
}

function calculateAndRender() {
  const result = calculate();
  renderRows(result);
  updateText(result);
  renderCalculationSteps(result);
  renderReport(result);
}

function persistState() {
  const params = {};
  paramIds.forEach((id) => {
    params[id] = $(id).value;
  });
  localStorage.setItem(STORAGE_KEY, JSON.stringify({ params, rows }));
}

function setInputValues(values) {
  paramIds.forEach((id) => {
    if (values[id] !== undefined) $(id).value = values[id];
  });
}

function loadPersistedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    if (saved.params) setInputValues(saved.params);
    if (Array.isArray(saved.rows)) rows = saved.rows;
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadSample() {
  setInputValues(sampleParams);
  rows = structuredClone(sampleRows);
  calculateAndRender();
  persistState();
}

function resetAll() {
  localStorage.removeItem(STORAGE_KEY);
  loadSample();
}

function bindEvents() {
  paramIds.forEach((id) => {
    $(id).addEventListener("input", () => {
      calculateAndRender();
      persistState();
    });
  });

  $("addRowBtn").addEventListener("click", () => {
    rows.push({ u1: "", u2: "", h: "" });
    calculateAndRender();
    persistState();
  });

  $("clearRowsBtn").addEventListener("click", () => {
    rows = structuredClone(blankRows);
    calculateAndRender();
    persistState();
  });

  $("loadSampleBtn").addEventListener("click", loadSample);
  $("resetBtn").addEventListener("click", resetAll);
}

setInputValues(sampleParams);
loadPersistedState();
bindEvents();
calculateAndRender();
