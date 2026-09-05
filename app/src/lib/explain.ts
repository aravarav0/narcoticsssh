import { THRESHOLDS } from "../color/constants"
import type { ClassifyDebug, QualityFlag, ResultLabel } from "../color/types"

export const FLAG_SHORT: Record<QualityFlag, string> = {
  card_missing: "No colour card",
  patch_too_small: "Hold closer",
  clipping: "Overexposed",
  glare: "Glare",
  ccm_unstable: "Weak calibration",
  classes_too_close: "Close match",
  far_from_all_refs: "No clear match",
}

const FLAG_WHY: Record<QualityFlag, string> = {
  card_missing:
    "The six colour-card squares are not in frame (or they all look the same grey). Without the card, lighting cannot be trusted.",
  patch_too_small:
    "A sample box had too few pixels. Hold closer so the kit and each square fill their frames.",
  clipping:
    "The kit is overexposed — whites are clipped at 255. Tilt the strip/vial so it is not a mirror.",
  glare:
    "A bright hotspot is sitting on the kit. That white blob is glare, not the test colour.",
  ccm_unstable:
    "The full 6-patch calibration was weak, so the app used only the gray square to correct the lamp colour.",
  classes_too_close:
    "Positive and negative were almost equally close. Guessing would be dishonest, so the call is inconclusive.",
  far_from_all_refs:
    "After correction, the kit colour did not sit near pale, purple, or muddy. The app will not invent a match.",
}

export function explainCall(result: ResultLabel, debug: ClassifyDebug): {
  headline: string
  bullets: string[]
  fatal: QualityFlag[]
} {
  const fatal = debug.qualityFlags.filter((f) => f !== "ccm_unstable")
  const { positive, negative, muddy } = debug.deltaE
  const nearest =
    positive <= negative && positive <= muddy
      ? "positive (purple)"
      : negative <= positive && negative <= muddy
        ? "negative (pale)"
        : "muddy / mixed"

  const bullets: string[] = []

  bullets.push(
    debug.method === "ccm"
      ? "Lighting was corrected from the six colour-card squares in this photo (colour-correction matrix)."
      : "Lighting was corrected from the gray square only (von Kries white balance).",
  )

  bullets.push(
    `After correction the kit was closest to ${nearest}: ΔE ${positive.toFixed(1)} to positive, ${negative.toFixed(1)} to negative, ${muddy.toFixed(1)} to muddy. Lower ΔE = closer colour.`,
  )

  bullets.push(
    `Hue ${debug.kitHsv.h.toFixed(0)}°, saturation ${(debug.kitHsv.s * 100).toFixed(0)}%, chroma ${debug.chroma.toFixed(1)}. Pale unused strips stay low-chroma; a developed purple jumps chroma and hue.`,
  )

  for (const f of debug.qualityFlags) bullets.push(FLAG_WHY[f])

  let headline: string
  if (result === "positive") {
    headline =
      "The kit colour matches the purple (positive) reference more closely than pale or muddy — with a clear gap, so this is a presumptive positive."
  } else if (result === "negative") {
    headline =
      "The kit looks uncoloured / pale. It sits nearer the negative reference than purple, so this is a presumptive negative."
  } else if (fatal.includes("card_missing")) {
    headline = "No reliable colour card in this photo. The app refuses to call positive or negative."
  } else if (fatal.includes("glare") || fatal.includes("clipping")) {
    headline = "The photo is optically unusable (glare or clipped highlights). Retake with a slight tilt."
  } else if (fatal.includes("classes_too_close")) {
    headline = "The two nearest classes are too close together. Inconclusive is the honest call."
  } else if (fatal.includes("far_from_all_refs")) {
    headline = `None of the three references is within ΔE ${THRESHOLDS.deltaEMax}. Inconclusive — not a guess.`
  } else {
    headline = "The kit is nearer the muddy / mixed reference, so the call is inconclusive."
  }

  return { headline, bullets, fatal }
}

export function closenessPct(deltaE: number): number {
  const cap = 40
  return Math.max(4, Math.round((1 - Math.min(deltaE, cap) / cap) * 100))
}
