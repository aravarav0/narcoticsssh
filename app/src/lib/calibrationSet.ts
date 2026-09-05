import { deriveClassModel, type CalibrationSample, type ClassModel } from "../color/classModel"
import { THRESHOLDS } from "../color/constants"
import type { ClassName, Lab } from "../color/types"

const KEY = "sih26231.calibrationSet.v1"
const MAX_PER_CLASS = 40

export type { CalibrationSample, ClassModel }

export function loadCalibrationSet(): CalibrationSample[] {
  try {
    const raw = localStorage.getItem(KEY)
    if (!raw) return []
    const parsed = JSON.parse(raw) as CalibrationSample[]
    if (!Array.isArray(parsed)) return []
    return parsed.filter(
      (s) =>
        s &&
        s.qualityStatus === "valid" &&
        (s.label === "positive" || s.label === "negative" || s.label === "muddy") &&
        s.lab &&
        typeof s.lab.L === "number",
    )
  } catch {
    return []
  }
}

export function saveCalibrationSet(samples: CalibrationSample[]) {
  localStorage.setItem(KEY, JSON.stringify(samples))
}

export function addCalibrationSample(input: {
  label: ClassName
  lab: Lab
  capturedAt: string
  qualityStatus: "valid" | "retake"
}): { ok: true; sample: CalibrationSample } | { ok: false; error: string } {
  if (input.qualityStatus !== "valid") {
    return { ok: false, error: "Only optically valid captures can enter the calibration set." }
  }
  const sample: CalibrationSample = {
    id: crypto.randomUUID(),
    label: input.label,
    lab: input.lab,
    capturedAt: input.capturedAt,
    qualityStatus: "valid",
  }
  const all = loadCalibrationSet()
  const ofLabel = all.filter((s) => s.label === input.label)
  const kept = all.filter((s) => s.label !== input.label).concat([...ofLabel, sample].slice(-MAX_PER_CLASS))
  saveCalibrationSet(kept)
  return { ok: true, sample }
}

export function clearCalibrationSet() {
  localStorage.removeItem(KEY)
}

export function calibrationCounts(samples = loadCalibrationSet()) {
  const n = (label: ClassName) => samples.filter((s) => s.label === label).length
  return {
    positive: n("positive"),
    negative: n("negative"),
    muddy: n("muddy"),
    min: THRESHOLDS.minSamplesPerClass,
  }
}

export function loadClassModel(): ClassModel {
  return deriveClassModel(loadCalibrationSet())
}
