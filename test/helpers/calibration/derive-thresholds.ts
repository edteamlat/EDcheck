import type { Calibration } from "./types/calibration.ts";
import type { CalibrationObservation } from "./types/calibration-observation.ts";

const GRID = 0.05;
const MARGIN = 0.05;
const MIN_THRESHOLD = 0.05;
const MAX_THRESHOLD = 0.95;

function withProbability(
  observations: readonly CalibrationObservation[],
  expect: "positive" | "negative" | "ambiguous",
): Array<CalibrationObservation & { probability: number }> {
  return observations.filter(
    (item): item is CalibrationObservation & { probability: number } =>
      item.expect === expect && item.probability !== undefined,
  );
}

function ceilToGrid(value: number): number {
  return Number((Math.ceil((value - Number.EPSILON) / GRID) * GRID).toFixed(2));
}

function floorToGrid(value: number): number {
  return Number((Math.floor((value + Number.EPSILON) / GRID) * GRID).toFixed(2));
}

function clamp(value: number): number {
  return Number(Math.min(MAX_THRESHOLD, Math.max(MIN_THRESHOLD, value)).toFixed(2));
}

function rate(items: readonly { probability: number }[], predicate: (p: number) => boolean): number {
  if (items.length === 0) {
    return 0;
  }
  return items.filter((item) => predicate(item.probability)).length / items.length;
}

export function deriveThresholds(observations: readonly CalibrationObservation[]): Calibration {
  const negatives = withProbability(observations, "negative");
  const positives = withProbability(observations, "positive");
  const ambiguous = withProbability(observations, "ambiguous");
  if (negatives.length === 0) {
    throw new Error("deriveThresholds missing label: negative");
  }
  if (positives.length === 0) {
    throw new Error("deriveThresholds missing label: positive");
  }
  const negativeMax = Math.max(...negatives.map((item) => item.probability));
  const positiveMin = Math.min(...positives.map((item) => item.probability));
  if (positiveMin <= negativeMax) {
    const overlapping = [
      ...positives.filter((item) => item.probability <= negativeMax).map((item) => item.id),
      ...negatives.filter((item) => item.probability >= positiveMin).map((item) => item.id),
    ];
    return { separable: false, overlapping, negativeMax, positiveMin };
  }
  let fail = ceilToGrid(negativeMax + MARGIN);
  let pass = floorToGrid(positiveMin - MARGIN);
  const narrowGap = fail > pass;
  if (narrowGap) {
    fail = floorToGrid((negativeMax + positiveMin) / 2);
    pass = Number((fail + GRID).toFixed(2));
  }
  fail = clamp(fail);
  pass = clamp(pass);
  return {
    separable: true,
    pass,
    fail,
    negativeMax,
    positiveMin,
    narrowGap,
    positiveDecisiveRate: rate(positives, (probability) => probability >= pass),
    negativeDecisiveRate: rate(negatives, (probability) => probability < fail),
    ambiguousInWarningRate: rate(
      ambiguous,
      (probability) => probability >= fail && probability < pass,
    ),
  };
}
