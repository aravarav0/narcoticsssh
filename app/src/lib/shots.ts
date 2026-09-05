export const CALIBRATION_SHOTS = [
  { id: "01-card-only-daylight", label: "1 · Card only, daylight" },
  { id: "02-negative-card-daylight", label: "2 · Negative + card, daylight" },
  { id: "03-positive-card-daylight", label: "3 · Positive + card, daylight" },
  { id: "04-positive-card-yellow", label: "4 · Positive + card, yellow lamp" },
  { id: "05-positive-no-card-yellow", label: "5 · Positive, NO card, yellow lamp" },
  { id: "06-negative-card-yellow", label: "6 · Negative + card, yellow lamp (optional)" },
] as const

export type CalibrationShotId = (typeof CALIBRATION_SHOTS)[number]["id"]
