const STORAGE_KEY = "surface-tension-lab-v3";

const sampleValues = {
  calibrationSlope: "0.00318177",
  calibrationIntercept: "0",
  calibrationSlopeUncertainty: "0.0000016",
  calibrationInterceptUncertainty: "0.000010",
  frameWidth: "39.00",
  frameThickness: "0.14",
  frameWidthUncertainty: "0.02",
  frameThicknessUncertainty: "0.01",
  maxVoltage: "1.56",
  ruptureVoltage: "-0.06",
  filmHeight: "3.37",
  filmHeightUncertainty: "0.01",
  liquidDensity: "1000.0",
  liquidDensityUncertainty: "5.0",
  ringInnerDiameter: "32.70",
  ringThickness: "1.00",
  ringCorrection: "1.000",
  ringInnerDiameterUncertainty: "0.02",
  ringThicknessUncertainty: "0.01",
  ringCorrectionUncertainty: "0.005",
  temperature: "25.0",
  voltageResolution: "0.01",
  displacementResolution: "0.01",
  confidenceLevel: "0.95",
};

const paramIds = Object.keys(sampleValues);

const $ = (id) => document.getElementById(id);

function numberFromInput(id, fallback = 0) {
  const element = $(id);
  if (!element) return fallback;
  const value = Number(element.value);
  return Number.isFinite(value) ? value : fallback;
}

function clamp(value, min, max) {
  return Math.min(Math.max(value, min), max);
}

function mmToM(value) {
  return value / 1000;
}

function square(value) {
  return value * value;
}

function safeSqrt(value) {
  return Math.sqrt(Math.max(0, value));
}

function formatNumber(value, digits = 4) {
  if (!Number.isFinite(value)) return "--";
  if (Math.abs(value) >= 1000 || (Math.abs(value) > 0 && Math.abs(value) < 0.001)) {
    return value.toExponential(3);
  }
  return value.toFixed(digits);
}

function formatVoltage(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value, 4)} mV`;
}

function formatForce(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value * 1000, 3)} mN`;
}

function formatGamma(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value * 1000, 3)} mN/m`;
}

function formatLength(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value * 1000, 3)} mm`;
}

function formatInterval(mean, expanded) {
  if (!Number.isFinite(mean) || !Number.isFinite(expanded)) return "等待有效数据";
  return `[${formatGamma(mean - expanded)}, ${formatGamma(mean + expanded)}]`;
}

function getGeometryType() {
  return document.querySelector('input[name="geometryType"]:checked')?.value || "frame";
}

function getParams() {
  const pInput = numberFromInput("confidenceLevel", 0.95);
  return {
    geometryType: getGeometryType(),
    calibrationSlope: numberFromInput("calibrationSlope"),
    calibrationIntercept: numberFromInput("calibrationIntercept"),
    calibrationSlopeUncertainty: Math.abs(numberFromInput("calibrationSlopeUncertainty")),
    calibrationInterceptUncertainty: Math.abs(numberFromInput("calibrationInterceptUncertainty")),
    frameWidth: numberFromInput("frameWidth"),
    frameThickness: numberFromInput("frameThickness"),
    frameWidthUncertainty: Math.abs(numberFromInput("frameWidthUncertainty")),
    frameThicknessUncertainty: Math.abs(numberFromInput("frameThicknessUncertainty")),
    maxVoltage: numberFromInput("maxVoltage"),
    ruptureVoltage: numberFromInput("ruptureVoltage"),
    filmHeight: numberFromInput("filmHeight"),
    filmHeightUncertainty: Math.abs(numberFromInput("filmHeightUncertainty")),
    liquidDensity: numberFromInput("liquidDensity"),
    liquidDensityUncertainty: Math.abs(numberFromInput("liquidDensityUncertainty")),
    ringInnerDiameter: numberFromInput("ringInnerDiameter"),
    ringThickness: numberFromInput("ringThickness"),
    ringCorrection: numberFromInput("ringCorrection", 1),
    ringInnerDiameterUncertainty: Math.abs(numberFromInput("ringInnerDiameterUncertainty")),
    ringThicknessUncertainty: Math.abs(numberFromInput("ringThicknessUncertainty")),
    ringCorrectionUncertainty: Math.abs(numberFromInput("ringCorrectionUncertainty")),
    temperature: numberFromInput("temperature"),
    voltageResolution: Math.abs(numberFromInput("voltageResolution")),
    displacementResolution: Math.abs(numberFromInput("displacementResolution")),
    confidenceLevel: clamp(pInput, 0.95, 0.999),
  };
}

function calculateVoltageForce(params) {
  const deltaVoltage = params.maxVoltage - params.ruptureVoltage;
  const sensorForce = params.calibrationSlope * deltaVoltage;
  const voltageStandard = params.voltageResolution / (2 * Math.sqrt(3));
  const deltaVoltageUncertainty = Math.sqrt(2) * voltageStandard;
  const forceUncertainty = safeSqrt(
    square(deltaVoltage * params.calibrationSlopeUncertainty) +
      square(params.calibrationSlope * deltaVoltageUncertainty),
  );

  return {
    deltaVoltage,
    deltaVoltageUncertainty,
    sensorForce,
    forceUncertainty,
  };
}

function calculateCurrentGamma(params) {
  const voltageForce = calculateVoltageForce(params);
  const { deltaVoltage, deltaVoltageUncertainty, sensorForce, forceUncertainty } = voltageForce;

  if (
    !Number.isFinite(deltaVoltage) ||
    !Number.isFinite(sensorForce) ||
    !Number.isFinite(forceUncertainty)
  ) {
    return invalidCalculation();
  }

  if (params.geometryType === "frame") {
    const length = mmToM(params.frameWidth);
    const thickness = mmToM(params.frameThickness);
    const maxDisplacement = mmToM(params.filmHeight);
    const uLength = mmToM(params.frameWidthUncertainty);
    const uThickness = mmToM(params.frameThicknessUncertainty);
    const uMaxDisplacement = mmToM(params.filmHeightUncertainty);
    const density = params.liquidDensity;
    const uDensity = params.liquidDensityUncertainty;
    const gravityAcceleration = 9.80665;
    const filmGravity = density * length * thickness * maxDisplacement * gravityAcceleration;
    const effectiveForce = sensorForce - filmGravity;
    const denominator = 2 * length;

    if (denominator <= 0 || !Number.isFinite(filmGravity)) {
      return invalidCalculation();
    }

    const gamma = effectiveForce / denominator;
    const dGammaDK = deltaVoltage / denominator;
    const dGammaDDeltaU = params.calibrationSlope / denominator;
    const dGammaDLength = -sensorForce / (2 * square(length));
    const dGammaDThickness = (-density * maxDisplacement * gravityAcceleration) / 2;
    const dGammaDDisplacement = (-density * thickness * gravityAcceleration) / 2;
    const dGammaDDensity = (-thickness * maxDisplacement * gravityAcceleration) / 2;
    const typeB = safeSqrt(
      square(dGammaDK * params.calibrationSlopeUncertainty) +
        square(dGammaDDeltaU * deltaVoltageUncertainty) +
        square(dGammaDLength * uLength) +
        square(dGammaDThickness * uThickness) +
        square(dGammaDDisplacement * uMaxDisplacement) +
        square(dGammaDDensity * uDensity),
    );

    return {
      gamma,
      typeB,
      forceUncertainty,
      denominator,
      deltaVoltage,
      sensorForce,
      filmGravity,
      effectiveForce,
      formula: "γ = [K(Umax - U断) - ρLdxmaxg] / 2L",
      steps: [
        `ΔU = Umax - U断 = ${formatVoltage(deltaVoltage)}`,
        `FΔU = KΔU = ${formatForce(sensorForce)}`,
        `G = ρLdxmaxg = ${formatForce(filmGravity)}`,
        `F = FΔU - G = ${formatForce(effectiveForce)}`,
        `γ = F / 2L = ${formatGamma(gamma)}`,
      ],
      uncertaintyRows: [
        ["K", "力传感器定标斜率", `${formatNumber(params.calibrationSlopeUncertainty, 6)} N/mV`],
        ["Umax - U断", "峰值与拉脱后稳定电压差", `${formatNumber(deltaVoltageUncertainty, 4)} mV`],
        ["L", "门型框内宽", `${formatNumber(params.frameWidthUncertainty, 3)} mm`],
        ["d", "门型框厚度", `${formatNumber(params.frameThicknessUncertainty, 3)} mm`],
        ["xmax", "最大位移", `${formatNumber(params.filmHeightUncertainty, 3)} mm`],
        ["ρ", "液体密度", `${formatNumber(params.liquidDensityUncertainty, 2)} kg/m³`],
      ],
    };
  }

  const innerDiameter = mmToM(params.ringInnerDiameter);
  const ringThickness = mmToM(params.ringThickness);
  const uInnerDiameter = mmToM(params.ringInnerDiameterUncertainty);
  const uRingThickness = mmToM(params.ringThicknessUncertainty);
  const correction = params.ringCorrection;
  const denominator = 2 * Math.PI * (innerDiameter + ringThickness);

  if (denominator <= 0) return invalidCalculation();

  const effectiveForce = sensorForce;
  const gamma = (correction * effectiveForce) / denominator;
  const cForce = correction / denominator;
  const cCorrection = effectiveForce / denominator;
  const cDiameter = (-correction * effectiveForce * 2 * Math.PI) / square(denominator);
  const cThickness = cDiameter;
  const typeB = safeSqrt(
    square(cForce * forceUncertainty) +
      square(cCorrection * params.ringCorrectionUncertainty) +
      square(cDiameter * uInnerDiameter) +
      square(cThickness * uRingThickness),
  );

  return {
    gamma,
    typeB,
    forceUncertainty,
    denominator,
    deltaVoltage,
    sensorForce,
    filmGravity: NaN,
    effectiveForce,
    formula: "γ = cK(Umax - U断) / [2π(R + r)]",
    steps: [
      `ΔU = Umax - U断 = ${formatVoltage(deltaVoltage)}`,
      `FΔU = KΔU = ${formatForce(sensorForce)}`,
      `2π(R + r) = ${formatLength(denominator)}`,
      `γ = cFΔU / [2π(R + r)] = ${formatGamma(gamma)}`,
    ],
    uncertaintyRows: [
      ["K", "力传感器定标斜率", `${formatNumber(params.calibrationSlopeUncertainty, 6)} N/mV`],
      ["Umax - U断", "峰值与拉脱后稳定电压差", `${formatNumber(deltaVoltageUncertainty, 4)} mV`],
      ["R", "金属环内径", `${formatNumber(params.ringInnerDiameterUncertainty, 3)} mm`],
      ["r", "金属环厚度", `${formatNumber(params.ringThicknessUncertainty, 3)} mm`],
      ["c", "金属环修正系数", formatNumber(params.ringCorrectionUncertainty, 4)],
    ],
  };
}

function invalidCalculation() {
  return {
    gamma: NaN,
    typeB: NaN,
    forceUncertainty: NaN,
    denominator: NaN,
    deltaVoltage: NaN,
    sensorForce: NaN,
    filmGravity: NaN,
    effectiveForce: NaN,
    formula: "--",
    steps: [],
    uncertaintyRows: [],
  };
}

function parseRepeatValues(currentGamma) {
  const text = $("repeatValues").value.trim();
  const values = text
    ? text
        .split(/[\s,，;；]+/)
        .map(Number)
        .filter(Number.isFinite)
    : [];
  if (values.length) return values;
  return Number.isFinite(currentGamma) ? [currentGamma] : [];
}

function mean(values) {
  if (!values.length) return NaN;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function sampleStandardDeviation(values) {
  if (values.length < 2) return 0;
  const avg = mean(values);
  const variance =
    values.reduce((sum, value) => sum + square(value - avg), 0) / (values.length - 1);
  return Math.sqrt(variance);
}

function normalInverse(probability) {
  const a = [
    -3.969683028665376e1,
    2.209460984245205e2,
    -2.759285104469687e2,
    1.38357751867269e2,
    -3.066479806614716e1,
    2.506628277459239,
  ];
  const b = [
    -5.447609879822406e1,
    1.615858368580409e2,
    -1.556989798598866e2,
    6.680131188771972e1,
    -1.328068155288572e1,
  ];
  const c = [
    -7.784894002430293e-3,
    -3.223964580411365e-1,
    -2.400758277161838,
    -2.549732539343734,
    4.374664141464968,
    2.938163982698783,
  ];
  const d = [
    7.784695709041462e-3,
    3.224671290700398e-1,
    2.445134137142996,
    3.754408661907416,
  ];
  const pLow = 0.02425;
  const pHigh = 1 - pLow;

  if (probability <= 0 || probability >= 1) return NaN;

  if (probability < pLow) {
    const q = Math.sqrt(-2 * Math.log(probability));
    return (
      (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
      ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
    );
  }

  if (probability <= pHigh) {
    const q = probability - 0.5;
    const r = q * q;
    return (
      (((((a[0] * r + a[1]) * r + a[2]) * r + a[3]) * r + a[4]) * r + a[5]) *
      q /
      (((((b[0] * r + b[1]) * r + b[2]) * r + b[3]) * r + b[4]) * r + 1)
    );
  }

  const q = Math.sqrt(-2 * Math.log(1 - probability));
  return -(
    (((((c[0] * q + c[1]) * q + c[2]) * q + c[3]) * q + c[4]) * q + c[5]) /
    ((((d[0] * q + d[1]) * q + d[2]) * q + d[3]) * q + 1)
  );
}

function studentTCoverageFactor(centralProbability, degreesOfFreedom) {
  const q = (1 + centralProbability) / 2;
  const z = normalInverse(q);
  if (!Number.isFinite(degreesOfFreedom) || degreesOfFreedom > 1000) return z;
  if (degreesOfFreedom <= 1) {
    return Math.tan(Math.PI * (q - 0.5));
  }

  const nu = degreesOfFreedom;
  const z2 = z * z;
  const z3 = z2 * z;
  const z5 = z3 * z2;
  const z7 = z5 * z2;

  return (
    z +
    (z3 + z) / (4 * nu) +
    (5 * z5 + 16 * z3 + 3 * z) / (96 * square(nu)) +
    (3 * z7 + 19 * z5 + 17 * z3 - 15 * z) / (384 * nu * nu * nu)
  );
}

function calculateUncertainty(params, current) {
  const repeatValues = parseRepeatValues(current.gamma);
  const average = mean(repeatValues);
  const standardDeviation = sampleStandardDeviation(repeatValues);
  const typeA = repeatValues.length >= 2 ? standardDeviation / Math.sqrt(repeatValues.length) : 0;
  const typeB = Number.isFinite(current.typeB) ? current.typeB : 0;
  const combined = safeSqrt(square(typeA) + square(typeB));
  const finiteTypeADf = typeA > 0 && repeatValues.length > 1 ? repeatValues.length - 1 : Infinity;
  const effectiveDf =
    Number.isFinite(finiteTypeADf) && combined > 0 && typeA > 0
      ? Math.pow(combined, 4) / (Math.pow(typeA, 4) / finiteTypeADf)
      : Infinity;
  const coverageFactor = studentTCoverageFactor(params.confidenceLevel, effectiveDf);
  const expanded = coverageFactor * combined;

  return {
    repeatValues,
    average,
    standardDeviation,
    typeA,
    typeB,
    combined,
    effectiveDf,
    coverageFactor,
    expanded,
  };
}

function renderModelVisibility() {
  const isFrame = getGeometryType() === "frame";
  $("frameGeometrySection").classList.toggle("hidden", !isFrame);
  $("ringGeometrySection").classList.toggle("hidden", isFrame);
}

function updateResultText(params, current, uncertainty) {
  $("maxForce").textContent = formatForce(current.sensorForce);
  $("filmGravity").textContent = params.geometryType === "frame" ? formatForce(current.filmGravity) : "--";
  $("effectiveForce").textContent = formatForce(current.effectiveForce);
  $("currentGamma").textContent = formatGamma(current.gamma);
  $("repeatCount").textContent = uncertainty.repeatValues.length
    ? String(uncertainty.repeatValues.length)
    : "--";
  $("meanGamma").textContent = formatGamma(uncertainty.average);
  $("typeA").textContent = formatGamma(uncertainty.typeA);
  $("typeB").textContent = formatGamma(uncertainty.typeB);
  $("combinedU").textContent = formatGamma(uncertainty.combined);
  $("coverageFactor").textContent = Number.isFinite(uncertainty.coverageFactor)
    ? `${formatNumber(uncertainty.coverageFactor, 3)} (p=${formatNumber(params.confidenceLevel, 3)})`
    : "--";
  $("expandedU").textContent = formatGamma(uncertainty.expanded);
  $("formulaText").textContent = current.formula;

  if (Number.isFinite(uncertainty.average) && Number.isFinite(uncertainty.expanded)) {
    $("finalGamma").textContent = `${formatGamma(uncertainty.average)} ± ${formatGamma(
      uncertainty.expanded,
    )}`;
    $("finalInterval").textContent = `置信区间：${formatInterval(
      uncertainty.average,
      uncertainty.expanded,
    )}`;
  } else {
    $("finalGamma").textContent = "--";
    $("finalInterval").textContent = "等待有效数据";
  }
}

function renderCenterResults(params, current, uncertainty) {
  $("centerGamma").textContent = formatGamma(current.gamma);
  $("centerInterval").textContent =
    Number.isFinite(uncertainty.average) && Number.isFinite(uncertainty.expanded)
      ? `置信区间：${formatInterval(uncertainty.average, uncertainty.expanded)}`
      : "等待有效数据";
  $("centerDeltaVoltage").textContent = formatVoltage(current.deltaVoltage);
  $("centerSensorForce").textContent = formatForce(current.sensorForce);
  $("centerFilmGravity").textContent =
    params.geometryType === "frame" ? formatForce(current.filmGravity) : "--";
  $("centerEffectiveForce").textContent = formatForce(current.effectiveForce);
  $("centerDenominator").textContent = formatLength(current.denominator);
  $("centerExpandedU").textContent = formatGamma(uncertainty.expanded);
  $("centerFormula").textContent = current.formula;
  $("calculationSteps").innerHTML = current.steps.length
    ? current.steps.map((step) => `<li>${step}</li>`).join("")
    : "<li>等待有效数据</li>";
}

function renderReport(params, current, uncertainty) {
  const modelName = params.geometryType === "frame" ? "门型金属框" : "金属环";
  const geometryRows =
    params.geometryType === "frame"
      ? `
        <tr><td>L</td><td>${formatNumber(params.frameWidth, 3)} mm</td></tr>
        <tr><td>d</td><td>${formatNumber(params.frameThickness, 3)} mm</td></tr>
        <tr><td>xmax</td><td>${formatNumber(params.filmHeight, 3)} mm</td></tr>
        <tr><td>ρ</td><td>${formatNumber(params.liquidDensity, 2)} kg/m³</td></tr>
      `
      : `
        <tr><td>R</td><td>${formatNumber(params.ringInnerDiameter, 3)} mm</td></tr>
        <tr><td>r</td><td>${formatNumber(params.ringThickness, 3)} mm</td></tr>
        <tr><td>c</td><td>${formatNumber(params.ringCorrection, 4)}</td></tr>
      `;

  const uncertaintyRows = current.uncertaintyRows
    .map(
      ([symbol, source, value]) => `
        <tr>
          <td>${symbol}</td>
          <td>${source}</td>
          <td>${value}</td>
        </tr>
      `,
    )
    .join("");

  const stepRows = current.steps.map((step) => `<li>${step}</li>`).join("");

  $("reportContent").innerHTML = `
    <article class="report-block">
      <h3>实验参数</h3>
      <table class="mini-table">
        <tbody>
          <tr><td>模型</td><td>${modelName}</td></tr>
          <tr><td>K</td><td>${formatNumber(params.calibrationSlope, 6)} N/mV</td></tr>
          <tr><td>b</td><td>${formatNumber(params.calibrationIntercept, 6)} N</td></tr>
          <tr><td>T</td><td>${formatNumber(params.temperature, 1)} °C</td></tr>
          ${geometryRows}
        </tbody>
      </table>
    </article>
    <article class="report-block">
      <h3>直接读数</h3>
      <ul>
        <li>Umax = ${formatNumber(params.maxVoltage, 4)} mV</li>
        <li>U断 = ${formatNumber(params.ruptureVoltage, 4)} mV</li>
        <li>ΔU = ${formatVoltage(current.deltaVoltage)}</li>
        <li>最大位移 xmax = ${formatNumber(params.filmHeight, 3)} mm</li>
      </ul>
    </article>
    <article class="report-block">
      <h3>统计结果</h3>
      <ul>
        <li>重复次数 n = ${uncertainty.repeatValues.length || "--"}</li>
        <li>平均值 γ̄ = ${formatGamma(uncertainty.average)}</li>
        <li>A 类 uA = ${formatGamma(uncertainty.typeA)}</li>
        <li>B 类 uB = ${formatGamma(uncertainty.typeB)}</li>
      </ul>
    </article>
    <article class="report-block">
      <h3>置信区间</h3>
      <ul>
        <li>p = ${formatNumber(params.confidenceLevel, 3)}</li>
        <li>k = ${formatNumber(uncertainty.coverageFactor, 3)}</li>
        <li>U = ${formatGamma(uncertainty.expanded)}</li>
        <li>${formatInterval(uncertainty.average, uncertainty.expanded)}</li>
      </ul>
    </article>
    <article class="report-block wide">
      <h3>计算展开</h3>
      <ul>
        ${stepRows || "<li>暂无有效计算</li>"}
      </ul>
    </article>
    <article class="report-block wide">
      <h3>不确定度分量</h3>
      <table class="mini-table">
        <thead>
          <tr><th>符号</th><th>来源</th><th>标准不确定度</th></tr>
        </thead>
        <tbody>
          ${uncertaintyRows || "<tr><td colspan=\"3\">暂无有效分量</td></tr>"}
        </tbody>
      </table>
    </article>
    <article class="report-block wide">
      <h3>实验结论</h3>
      <p>
        在 ${formatNumber(params.temperature, 1)} °C 条件下，采用 ${modelName} 模型处理数据。
        本页不使用过程曲线拟合，仅根据 Umax、U断 和最大位移等直接读数计算，最终结果为
        <strong>${formatGamma(uncertainty.average)} ± ${formatGamma(uncertainty.expanded)}</strong>，
        置信水平 p = ${formatNumber(params.confidenceLevel, 3)}。
      </p>
    </article>
  `;
}

function calculateAndRender() {
  renderModelVisibility();
  const params = getParams();
  const current = calculateCurrentGamma(params);
  const uncertainty = calculateUncertainty(params, current);

  updateResultText(params, current, uncertainty);
  renderCenterResults(params, current, uncertainty);
  renderReport(params, current, uncertainty);
}

function persistState() {
  const params = {};
  paramIds.forEach((id) => {
    params[id] = $(id).value;
  });
  const payload = {
    params,
    geometryType: getGeometryType(),
    repeatValues: $("repeatValues").value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
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
    if (saved.geometryType) {
      const modelInput = document.querySelector(
        `input[name="geometryType"][value="${saved.geometryType}"]`,
      );
      if (modelInput) modelInput.checked = true;
    }
    if (typeof saved.repeatValues === "string") {
      $("repeatValues").value = saved.repeatValues;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadSample() {
  setInputValues(sampleValues);
  $("repeatValues").value = "";
  document.querySelector('input[name="geometryType"][value="frame"]').checked = true;
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

  document.querySelectorAll('input[name="geometryType"]').forEach((input) => {
    input.addEventListener("change", () => {
      calculateAndRender();
      persistState();
    });
  });

  $("repeatValues").addEventListener("input", () => {
    calculateAndRender();
    persistState();
  });

  $("loadSampleBtn").addEventListener("click", loadSample);
  $("resetBtn").addEventListener("click", resetAll);
}

setInputValues(sampleValues);
loadPersistedState();
bindEvents();
calculateAndRender();
