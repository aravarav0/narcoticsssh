import { CARD_SRGB, PATCH_ORDER, defaultClassLabs } from "../color/card"
import { DEFAULT_LAYOUT } from "../color/constants"
import type { Lab, PatchId, Rgb8 } from "../color/types"

const PRINT_KEY = "sih26231.v4.printRunRgb"
const CLASS_KEY = "sih26231.v4.classLabs"

export type ClassLabs = { negative: Lab; positive: Lab; muddy: Lab }

export function loadPrintRunRgb(): Record<PatchId, Rgb8> | undefined {
  try {
    const raw = localStorage.getItem(PRINT_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as Record<PatchId, Rgb8>
    for (const id of PATCH_ORDER) {
      if (!parsed[id]) return undefined
    }
    return parsed
  } catch {
    return undefined
  }
}

export function savePrintRunRgb(rgb: Record<PatchId, Rgb8>) {
  localStorage.setItem(PRINT_KEY, JSON.stringify(rgb))
}

export function hasPrintRun(): boolean {
  return loadPrintRunRgb() != null
}

export function loadClassLabs(): ClassLabs | undefined {
  try {
    const raw = localStorage.getItem(CLASS_KEY)
    if (!raw) return undefined
    const parsed = JSON.parse(raw) as ClassLabs
    if (!parsed.negative || !parsed.positive || !parsed.muddy) return undefined
    return parsed
  } catch {
    return undefined
  }
}

export function saveClassLabs(labs: ClassLabs) {
  localStorage.setItem(CLASS_KEY, JSON.stringify(labs))
}

export function setPositiveLab(lab: Lab) {
  const current = loadClassLabs() ?? defaultClassLabs()
  saveClassLabs({ ...current, positive: lab })
}

export function setNegativeLab(lab: Lab) {
  const current = loadClassLabs() ?? defaultClassLabs()
  saveClassLabs({ ...current, negative: lab })
}

export function clearBenchmarks() {
  localStorage.removeItem(PRINT_KEY)
  localStorage.removeItem(CLASS_KEY)
}

export function benchmarkStatus() {
  return {
    card: hasPrintRun(),
    classes: loadClassLabs() != null,
  }
}

export const intendedCard = CARD_SRGB
export const layout = DEFAULT_LAYOUT
