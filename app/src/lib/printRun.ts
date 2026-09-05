import { CARD_SRGB, PATCH_ORDER } from "../color/card"
import { DEFAULT_LAYOUT } from "../color/constants"
import type { PatchId, Rgb8 } from "../color/types"

/** Legacy key: raw patch JPEG RGB. Still read so older localStorage keeps working. */
const LEGACY_KEY = "sih26231.printRunRgb"
const KEY = "sih26231.cardBaseline.v1"

/**
 * Controlled baseline of *this physical print* under a chosen light.
 * Values are camera JPEG RGB, not an objectively known physical colour.
 */
export type CardBaseline = {
  rgb: Record<PatchId, Rgb8>
  capturedAt: string
  source: "controlled_baseline" | "legacy_print_run"
}

function isPatchMap(parsed: unknown): parsed is Record<PatchId, Rgb8> {
  if (!parsed || typeof parsed !== "object") return false
  const rec = parsed as Record<string, unknown>
  for (const id of PATCH_ORDER) {
    const v = rec[id]
    if (!v || typeof v !== "object") return false
    const rgb = v as Rgb8
    if (![rgb.r, rgb.g, rgb.b].every((n) => typeof n === "number")) return false
  }
  return true
}

export function loadCardBaseline(): CardBaseline | undefined {
  try {
    const raw = localStorage.getItem(KEY)
    if (raw) {
      const parsed = JSON.parse(raw) as CardBaseline
      if (parsed?.rgb && isPatchMap(parsed.rgb)) {
        return {
          rgb: parsed.rgb,
          capturedAt: parsed.capturedAt ?? "unknown",
          source: parsed.source === "legacy_print_run" ? "legacy_print_run" : "controlled_baseline",
        }
      }
    }
    const legacy = localStorage.getItem(LEGACY_KEY)
    if (!legacy) return undefined
    const parsed = JSON.parse(legacy) as Record<PatchId, Rgb8>
    if (!isPatchMap(parsed)) return undefined
    return { rgb: parsed, capturedAt: "unknown", source: "legacy_print_run" }
  } catch {
    return undefined
  }
}

export function saveCardBaseline(rgb: Record<PatchId, Rgb8>) {
  const baseline: CardBaseline = {
    rgb,
    capturedAt: new Date().toISOString(),
    source: "controlled_baseline",
  }
  localStorage.setItem(KEY, JSON.stringify(baseline))
  localStorage.setItem(LEGACY_KEY, JSON.stringify(rgb))
}

/** @deprecated Use loadCardBaseline().rgb — JPEG baseline, not physical ground truth. */
export function loadPrintRunRgb(): Record<PatchId, Rgb8> | undefined {
  return loadCardBaseline()?.rgb
}

/** @deprecated Use saveCardBaseline. */
export function savePrintRunRgb(rgb: Record<PatchId, Rgb8>) {
  saveCardBaseline(rgb)
}

export const intendedCard = CARD_SRGB
export const layout = DEFAULT_LAYOUT
