const STORAGE_KEY = "surface-tension-lab-v1";

const sampleRows = [
  { displacement: "0.0", voltage: "0.10" },
  { displacement: "0.5", voltage: "0.52" },
  { displacement: "1.0", voltage: "1.10" },
  { displacement: "1.5", voltage: "2.05" },
  { displacement: "2.0", voltage: "3.44" },
  { displacement: "2.5", voltage: "5.10" },
  { displacement: "3.0", voltage: "6.72" },
  { displacement: "3.5", voltage: "7.95" },
  { displacement: "4.0", voltage: "8.70" },
  { displacement: "4.5", voltage: "8.95" },
  { displacement: "5.0", voltage: "8.60" },
  { displacement: "5.5", voltage: "7.40" },
  { displacement: "6.0", voltage: "4.20" },
];

const blankRows = Array.from({ length: 8 }, () => ({
  displacement: "",
  voltage: "",
}));

const paramIds = [
  "calibrationSlope",
  "calibrationIntercept",
  "calibrationSlopeUncertainty",
  "calibrationInterceptUncertainty",
  "frameWidth",
  "frameThickness",
  "frameWidthUncertainty",
  "frameThicknessUncertainty",
  "maxVoltage",
  "ruptureVoltage",
  "filmHeight",
  "filmHeightUncertainty",
  "liquidDensity",
  "liquidDensityUncertainty",
  "ringInnerDiameter",
  "ringThickness",
  "ringCorrection",
  "ringInnerDiameterUncertainty",
  "ringThicknessUncertainty",
  "ringCorrectionUncertainty",
  "temperature",
  "voltageResolution",
  "displacementResolution",
  "confidenceLevel",
  "manualZeroVoltage",
];

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

function formatForce(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value * 1000, 3)} mN`;
}

function formatGamma(value) {
  if (!Number.isFinite(value)) return "--";
  return `${formatNumber(value * 1000, 3)} mN/m`;
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
    useFirstPointZero: $("useFirstPointZero").checked,
    manualZeroVoltage: numberFromInput("manualZeroVoltage"),
  };
}

function getZeroVoltage(params, rawRows) {
  if (!params.useFirstPointZero) return params.manualZeroVoltage;
  const firstValid = rawRows.find((row) => Number.isFinite(row.voltage));
  return firstValid ? firstValid.voltage : NaN;
}

function getComputedRows(params) {
  const rawRows = rows.map((row, index) => ({
    rowIndex: index,
    displacement: parseMaybeNumber(row.displacement),
    voltage: parseMaybeNumber(row.voltage),
  }));
  const zeroVoltage = getZeroVoltage(params, rawRows);
  return rawRows.map((row) => {
    const deltaVoltage = row.voltage - zeroVoltage;
    const force =
      Number.isFinite(deltaVoltage) && Number.isFinite(params.calibrationSlope)
        ? params.calibrationSlope * deltaVoltage + params.calibrationIntercept
        : NaN;
    return {
      ...row,
      zeroVoltage,
      deltaVoltage,
      force,
    };
  });
}

function getMaxForceRow(computedRows) {
  const valid = computedRows.filter((row) => Number.isFinite(row.force));
  if (!valid.length) return null;
  return valid.reduce((best, row) => (row.force > best.force ? row : best), valid[0]);
}

function calculateCurrentGamma(params, maxRow) {
  if (params.geometryType === "frame") {
    const length = mmToM(params.frameWidth);
    const thickness = mmToM(params.frameThickness);
    const filmHeight = mmToM(params.filmHeight);
    const uLength = mmToM(params.frameWidthUncertainty);
    const uThickness = mmToM(params.frameThicknessUncertainty);
    const uFilmHeight = mmToM(params.filmHeightUncertainty);
    const density = params.liquidDensity;
    const uDensity = params.liquidDensityUncertainty;
    const gravityAcceleration = 9.80665;
    const deltaVoltage = params.maxVoltage - params.ruptureVoltage;
    const sensorForce = params.calibrationSlope * deltaVoltage;
    const filmGravity = density * length * thickness * filmHeight * gravityAcceleration;
    const effectiveForce = sensorForce - filmGravity;
    const denominator = 2 * length;

    if (
      denominator <= 0 ||
      !Number.isFinite(deltaVoltage) ||
      !Number.isFinite(sensorForce) ||
      !Number.isFinite(filmGravity)
    ) {
      return invalidCalculation();
    }

    const gamma = effectiveForce / denominator;
    const voltageStandard = params.voltageResolution / (2 * Math.sqrt(3));
    const deltaVoltageUncertainty = Math.sqrt(2) * voltageStandard;
    const dGammaDK = deltaVoltage / denominator;
    const dGammaDDeltaU = params.calibrationSlope / denominator;
    const dGammaDLength = -sensorForce / (2 * square(length));
    const dGammaDThickness = (-density * filmHeight * gravityAcceleration) / 2;
    const dGammaDHeight = (-density * thickness * gravityAcceleration) / 2;
    const dGammaDDensity = (-thickness * filmHeight * gravityAcceleration) / 2;
    const typeB = safeSqrt(
      square(dGammaDK * params.calibrationSlopeUncertainty) +
        square(dGammaDDeltaU * deltaVoltageUncertainty) +
        square(dGammaDLength * uLength) +
        square(dGammaDThickness * uThickness) +
        square(dGammaDHeight * uFilmHeight) +
        square(dGammaDDensity * uDensity),
    );
    const forceUncertainty = safeSqrt(
      square(deltaVoltage * params.calibrationSlopeUncertainty) +
        square(params.calibrationSlope * deltaVoltageUncertainty),
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
      formula: "γ = [K(Umax - U断后) - ρLdxg] / 2L",
      uncertaintyRows: [
        ["K", "力传感器定标斜率", `${formatNumber(params.calibrationSlopeUncertainty, 6)} N/mV`],
        ["Umax - U断后", "峰值与断裂后负电压差", `${formatNumber(deltaVoltageUncertainty, 4)} mV`],
        ["L", "门型框内宽", `${formatNumber(params.frameWidthUncertainty, 3)} mm`],
        ["d", "门型框厚度", `${formatNumber(params.frameThicknessUncertainty, 3)} mm`],
        ["x", "拉起液膜高度", `${formatNumber(params.filmHeightUncertainty, 3)} mm`],
        ["ρ", "液体密度", `${formatNumber(params.liquidDensityUncertainty, 2)} kg/m³`],
      ],
    };
  }

  if (!maxRow || !Number.isFinite(maxRow.force)) return invalidCalculation();

  const force = maxRow.force;
  const deltaVoltage = maxRow.deltaVoltage;
  const voltageStandard = params.voltageResolution / (2 * Math.sqrt(3));
  const deltaVoltageUncertainty = Math.sqrt(2) * voltageStandard;
  const forceUncertainty = safeSqrt(
    square(deltaVoltage * params.calibrationSlopeUncertainty) +
      square(params.calibrationSlope * deltaVoltageUncertainty) +
      square(params.calibrationInterceptUncertainty),
  );

  const innerDiameter = mmToM(params.ringInnerDiameter);
  const ringThickness = mmToM(params.ringThickness);
  const uInnerDiameter = mmToM(params.ringInnerDiameterUncertainty);
  const uRingThickness = mmToM(params.ringThicknessUncertainty);
  const correction = params.ringCorrection;
  const denominator = 2 * Math.PI * (innerDiameter + ringThickness);

  if (denominator <= 0) return invalidCalculation();

  const gamma = (correction * force) / denominator;
  const cForce = correction / denominator;
  const cCorrection = force / denominator;
  const cDiameter = (-correction * force * 2 * Math.PI) / square(denominator);
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
    formula: "γ = cFmax / [2π(R + r)]",
    uncertaintyRows: [
      ["Fmax", "力传感器与电压读数", formatForce(forceUncertainty)],
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

function renderRows() {
  const body = $("rawDataBody");
  body.innerHTML = rows
    .map(
      (row, index) => `
        <tr data-row="${index}">
          <td>${index + 1}</td>
          <td>
            <input type="number" step="0.001" value="${row.displacement}" data-field="displacement" data-index="${index}" aria-label="第${index + 1}行位移" />
          </td>
          <td>
            <input type="number" step="0.001" value="${row.voltage}" data-field="voltage" data-index="${index}" aria-label="第${index + 1}行电压" />
          </td>
          <td class="force-cell" id="forceCell-${index}">--</td>
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
      if (!rows.length) rows.push({ displacement: "", voltage: "" });
      renderRows();
      calculateAndRender();
      persistState();
    });
  });
}

function renderForceCells(computedRows, maxRow) {
  computedRows.forEach((row) => {
    const cell = $(`forceCell-${row.rowIndex}`);
    const tableRow = document.querySelector(`tr[data-row="${row.rowIndex}"]`);
    if (cell) cell.textContent = formatForce(row.force);
    if (tableRow) tableRow.classList.toggle("max-row", maxRow?.rowIndex === row.rowIndex);
  });
}

function renderModelVisibility() {
  const isFrame = getGeometryType() === "frame";
  $("frameGeometrySection").classList.toggle("hidden", !isFrame);
  $("ringGeometrySection").classList.toggle("hidden", isFrame);
  $("manualZeroVoltage").disabled = $("useFirstPointZero").checked;
}

function updateResultText(params, maxRow, current, uncertainty) {
  const displayedSensorForce =
    params.geometryType === "frame" ? current.sensorForce : maxRow?.force;
  $("maxForce").textContent = formatForce(displayedSensorForce);
  $("filmGravity").textContent = params.geometryType === "frame" ? formatForce(current.filmGravity) : "--";
  $("effectiveForce").textContent =
    params.geometryType === "frame" ? formatForce(current.effectiveForce) : formatForce(maxRow?.force);
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

function renderCharts(computedRows, maxRow) {
  const chartRows = computedRows.filter((row) => Number.isFinite(row.displacement));
  $("voltageChartMeta").textContent = `${chartRows.length} 个有效位移点`;
  $("forceChartMeta").textContent = maxRow ? `Fmax 行：${maxRow.rowIndex + 1}` : "--";

  drawLineChart($("voltageChart"), chartRows, {
    yKey: "voltage",
    yLabel: "U / mV",
    highlightRowIndex: maxRow?.rowIndex,
  });
  drawLineChart($("forceChart"), chartRows, {
    yKey: "force",
    yLabel: "F / N",
    highlightRowIndex: maxRow?.rowIndex,
  });
}

function drawLineChart(container, data, options) {
  const width = 520;
  const height = 260;
  const padding = { top: 18, right: 18, bottom: 34, left: 52 };
  const valid = data.filter(
    (row) => Number.isFinite(row.displacement) && Number.isFinite(row[options.yKey]),
  );

  if (valid.length < 2) {
    container.innerHTML = `
      <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.yLabel}曲线">
        <text x="${width / 2}" y="${height / 2}" text-anchor="middle">请输入至少两个有效数据点</text>
      </svg>
    `;
    return;
  }

  let xMin = Math.min(...valid.map((row) => row.displacement));
  let xMax = Math.max(...valid.map((row) => row.displacement));
  let yMin = Math.min(...valid.map((row) => row[options.yKey]));
  let yMax = Math.max(...valid.map((row) => row[options.yKey]));

  if (xMin === xMax) {
    xMin -= 1;
    xMax += 1;
  }
  if (yMin === yMax) {
    yMin -= 1;
    yMax += 1;
  }

  const yPadding = (yMax - yMin) * 0.08;
  yMin -= yPadding;
  yMax += yPadding;

  const xScale = (value) =>
    padding.left +
    ((value - xMin) / (xMax - xMin)) * (width - padding.left - padding.right);
  const yScale = (value) =>
    height -
    padding.bottom -
    ((value - yMin) / (yMax - yMin)) * (height - padding.top - padding.bottom);

  const gridLines = Array.from({ length: 5 }, (_, index) => {
    const ratio = index / 4;
    const y = padding.top + ratio * (height - padding.top - padding.bottom);
    const value = yMax - ratio * (yMax - yMin);
    return `
      <line class="grid" x1="${padding.left}" y1="${y}" x2="${width - padding.right}" y2="${y}" />
      <text x="${padding.left - 8}" y="${y + 4}" text-anchor="end">${formatNumber(value, 3)}</text>
    `;
  }).join("");

  const points = valid.map((row) => `${xScale(row.displacement)},${yScale(row[options.yKey])}`).join(" ");
  const circles = valid
    .map((row) => {
      const className = row.rowIndex === options.highlightRowIndex ? "highlight" : "point";
      const radius = row.rowIndex === options.highlightRowIndex ? 5 : 3.5;
      return `<circle class="${className}" cx="${xScale(row.displacement)}" cy="${yScale(
        row[options.yKey],
      )}" r="${radius}" />`;
    })
    .join("");

  container.innerHTML = `
    <svg viewBox="0 0 ${width} ${height}" role="img" aria-label="${options.yLabel}曲线">
      ${gridLines}
      <line class="axis" x1="${padding.left}" y1="${height - padding.bottom}" x2="${
        width - padding.right
      }" y2="${height - padding.bottom}" />
      <line class="axis" x1="${padding.left}" y1="${padding.top}" x2="${padding.left}" y2="${
        height - padding.bottom
      }" />
      <polyline class="line" points="${points}" />
      ${circles}
      <text x="${width / 2}" y="${height - 8}" text-anchor="middle">x / mm</text>
      <text x="16" y="${height / 2}" transform="rotate(-90 16 ${height / 2})" text-anchor="middle">${
        options.yLabel
      }</text>
      <text x="${padding.left}" y="${height - padding.bottom + 20}" text-anchor="middle">${formatNumber(
        xMin,
        2,
      )}</text>
      <text x="${width - padding.right}" y="${height - padding.bottom + 20}" text-anchor="middle">${formatNumber(
        xMax,
        2,
      )}</text>
    </svg>
  `;
}

function renderReport(params, maxRow, current, uncertainty) {
  const modelName = params.geometryType === "frame" ? "门型金属框" : "金属环";
  const geometryRows =
    params.geometryType === "frame"
      ? `
        <tr><td>L</td><td>${formatNumber(params.frameWidth, 3)} mm</td></tr>
        <tr><td>d</td><td>${formatNumber(params.frameThickness, 3)} mm</td></tr>
        <tr><td>x</td><td>${formatNumber(params.filmHeight, 3)} mm</td></tr>
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
      <h3>关键计算</h3>
      <ul>
        <li>Umax = ${formatNumber(params.maxVoltage, 4)} mV</li>
        <li>断后电压 = ${formatNumber(params.ruptureVoltage, 4)} mV</li>
        <li>ΔU = Umax - U断后 = ${formatNumber(current.deltaVoltage, 4)} mV</li>
        <li>电压差张力 FΔU = ${formatForce(current.sensorForce)}</li>
        <li>液膜重力 G = ρLdxg = ${formatForce(current.filmGravity)}</li>
        <li>有效张力 F = FΔU - G = ${formatForce(current.effectiveForce)}</li>
        <li>当前计算公式：${current.formula}</li>
        <li>当前曲线 γ = ${formatGamma(current.gamma)}</li>
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
        按 GUM 不确定度传播律计算，最终结果为
        <strong>${formatGamma(uncertainty.average)} ± ${formatGamma(uncertainty.expanded)}</strong>，
        置信水平 p = ${formatNumber(params.confidenceLevel, 3)}。
      </p>
    </article>
  `;
}

function calculateAndRender() {
  renderModelVisibility();
  const params = getParams();
  const computedRows = getComputedRows(params);
  const maxRow = getMaxForceRow(computedRows);
  const current = calculateCurrentGamma(params, maxRow);
  const uncertainty = calculateUncertainty(params, current);

  renderForceCells(computedRows, maxRow);
  renderCharts(computedRows, maxRow);
  updateResultText(params, maxRow, current, uncertainty);
  renderReport(params, maxRow, current, uncertainty);
}

function persistState() {
  const params = {};
  paramIds.forEach((id) => {
    params[id] = $(id).value;
  });
  const payload = {
    rows,
    params,
    geometryType: getGeometryType(),
    useFirstPointZero: $("useFirstPointZero").checked,
    repeatValues: $("repeatValues").value,
  };
  localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
}

function loadPersistedState() {
  try {
    const saved = JSON.parse(localStorage.getItem(STORAGE_KEY));
    if (!saved) return;
    if (Array.isArray(saved.rows)) rows = saved.rows;
    if (saved.params) {
      paramIds.forEach((id) => {
        if (saved.params[id] !== undefined) $(id).value = saved.params[id];
      });
    }
    if (saved.geometryType) {
      const modelInput = document.querySelector(
        `input[name="geometryType"][value="${saved.geometryType}"]`,
      );
      if (modelInput) modelInput.checked = true;
    }
    if (typeof saved.useFirstPointZero === "boolean") {
      $("useFirstPointZero").checked = saved.useFirstPointZero;
    }
    if (typeof saved.repeatValues === "string") {
      $("repeatValues").value = saved.repeatValues;
    }
  } catch {
    localStorage.removeItem(STORAGE_KEY);
  }
}

function loadSample() {
  rows = structuredClone(sampleRows);
  $("calibrationSlope").value = "0.00082";
  $("calibrationIntercept").value = "0";
  $("calibrationSlopeUncertainty").value = "0.00002";
  $("calibrationInterceptUncertainty").value = "0.00002";
  $("frameWidth").value = "50.00";
  $("frameThickness").value = "0.80";
  $("frameWidthUncertainty").value = "0.02";
  $("frameThicknessUncertainty").value = "0.01";
  $("maxVoltage").value = "8.95";
  $("ruptureVoltage").value = "-0.20";
  $("filmHeight").value = "4.50";
  $("filmHeightUncertainty").value = "0.01";
  $("liquidDensity").value = "1000.0";
  $("liquidDensityUncertainty").value = "5.0";
  $("confidenceLevel").value = "0.95";
  $("useFirstPointZero").checked = true;
  $("repeatValues").value = "0.0712, 0.0716, 0.0720, 0.0714, 0.0718";
  document.querySelector('input[name="geometryType"][value="frame"]').checked = true;
  renderRows();
  calculateAndRender();
  persistState();
}

function resetAll() {
  rows = structuredClone(blankRows);
  $("repeatValues").value = "";
  localStorage.removeItem(STORAGE_KEY);
  renderRows();
  calculateAndRender();
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

  $("useFirstPointZero").addEventListener("change", () => {
    calculateAndRender();
    persistState();
  });

  $("repeatValues").addEventListener("input", () => {
    calculateAndRender();
    persistState();
  });

  $("addRowBtn").addEventListener("click", () => {
    rows.push({ displacement: "", voltage: "" });
    renderRows();
    calculateAndRender();
    persistState();
  });

  $("addFiveRowsBtn").addEventListener("click", () => {
    rows.push(...structuredClone(blankRows.slice(0, 5)));
    renderRows();
    calculateAndRender();
    persistState();
  });

  $("clearRowsBtn").addEventListener("click", () => {
    rows = structuredClone(blankRows);
    renderRows();
    calculateAndRender();
    persistState();
  });

  $("loadSampleBtn").addEventListener("click", loadSample);
  $("resetBtn").addEventListener("click", resetAll);
}

loadPersistedState();
bindEvents();
renderRows();
calculateAndRender();
