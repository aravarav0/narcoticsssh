import { CARD_SRGB, PATCH_ORDER } from "../color/card"
import { DEFAULT_LAYOUT } from "../color/constants"
import type { PatchId, Rgb8 } from "../color/types"

const PRINT_KEY = "sih26231.printRunRgb"

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

export const intendedCard = CARD_SRGB
export const layout = DEFAULT_LAYOUT
