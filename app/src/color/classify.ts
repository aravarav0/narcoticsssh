import { CARD_SRGB, PATCH_ORDER, defaultClassLabs } from "./card"
import { applyCcm, fitCcm, intendedPatchXyz, vonKries } from "./ccm"
import { DEFAULT_LAYOUT, THRESHOLDS } from "./constants"
import { rgb8ToHsv } from "./hsv"
import { sampleKit, samplePatch } from "./roi"
import {
  chroma,
  chromaticity,
  deltaE76,
  linearToRgb8,
  linearToXyz,
  rgb8ToLab,
  rgb8ToLinear,
  xyzToLab,
  xyzToLinear,
} from "./srgb"
import type {
  ClassifyOutput,
  Lab,
  Layout,
  PatchId,
  PixelBuffer,
  QualityFlag,
  ResultLabel,
  Rgb8,
} from "./types"

export type ClassLabs = { negative: Lab; positive: Lab; muddy: Lab }

/**
 * Full capture → result. Overlay layout must match the camera UI.
 * `printRunRgb` overrides intended patch sRGB after you photograph your actual print.
 */
export function classifyImage(
  image: PixelBuffer,
  opts?: {
    layout?: Layout
    classLabs?: ClassLabs
    printRunRgb?: Record<PatchId, Rgb8>
  },
): ClassifyOutput {
  const layout = opts?.layout ?? DEFAULT_LAYOUT
  const classLabs = opts?.classLabs ?? defaultClassLabs()
  const targets = opts?.printRunRgb ?? CARD_SRGB
  const flags: QualityFlag[] = []

  const patches = PATCH_ORDER.map((id) => samplePatch(image, id, layout.patches[id]))
  const kit = sampleKit(image, layout.kit)

  for (const p of patches) {
    if (p.pixelCount < THRESHOLDS.minPatchPixels) flags.push("patch_too_small")
    if (p.id !== "white" && p.id !== "black" && p.clipFraction > THRESHOLDS.clipFractionMax) {
      flags.push("clipping")
    }
    if (p.channelSpread > THRESHOLDS.maxPatchChannelSpread) flags.push("patch_uneven")
  }
  if (kit.pixelCount < THRESHOLDS.minPatchPixels) flags.push("patch_too_small")
  if (kit.clipFraction > THRESHOLDS.clipFractionMax) flags.push("clipping")
  if (kit.glareFraction > THRESHOLDS.glareFractionMax) flags.push("glare")
  if (kit.channelSpread > THRESHOLDS.maxKitChannelSpread) flags.push("kit_uneven")

  const whiteLab = rgb8ToLab(byId(patches, "white").medianRgb)
  const blackLab = rgb8ToLab(byId(patches, "black").medianRgb)
  if (whiteLab.L - blackLab.L < THRESHOLDS.minWhiteMinusBlackL) flags.push("card_missing")

  const chromatic = (["red", "yellow", "purple"] as const).map((id) => chroma(rgb8ToLab(byId(patches, id).medianRgb)))
  if (chromatic.every((c) => c < THRESHOLDS.minChromaticPatchChroma)) flags.push("card_missing")
  const chromaticLabs = (["red", "yellow", "purple"] as const).map((id) => rgb8ToLab(byId(patches, id).medianRgb))
  if (minPairwiseDeltaE(chromaticLabs) < THRESHOLDS.minChromaticPatchSeparation) flags.push("card_inconsistent")

  const observed = PATCH_ORDER.map((id) => byId(patches, id).medianRgb)
  const targetXyz = PATCH_ORDER.map((id) => linearToXyz(rgb8ToLinear(targets[id])))
  const ccm = fitCcm(observed, targetXyz)

  let method: "ccm" | "von_kries" = "von_kries"
  let kitLab: Lab
  let kitLin = rgb8ToLinear(kit.medianRgb)

  if (ccm && ccm.residualRms <= THRESHOLDS.ccmResidualMax) {
    method = "ccm"
    const xyz = applyCcm(kitLin, ccm.M)
    kitLab = xyzToLab(xyz)
    kitLin = xyzToLinear(xyz)
  } else {
    flags.push("ccm_unstable")
    const grayObs = rgb8ToLinear(byId(patches, "gray").medianRgb)
    const grayTgt = rgb8ToLinear(targets.gray)
    kitLin = vonKries(kitLin, grayObs, grayTgt)
    kitLab = xyzToLab(linearToXyz(kitLin))
  }

  const kitRgb = linearToRgb8(kitLin)
  const kitHsv = rgb8ToHsv(kitRgb)
  const deltaE = {
    negative: deltaE76(kitLab, classLabs.negative),
    positive: deltaE76(kitLab, classLabs.positive),
    muddy: deltaE76(kitLab, classLabs.muddy),
  }

  const ranked = (Object.entries(deltaE) as [keyof typeof deltaE, number][]).sort((a, b) => a[1] - b[1])
  const [nearest, d1] = ranked[0]
  const d2 = ranked[1][1]
  if (d1 > THRESHOLDS.deltaEMax) flags.push("far_from_all_refs")
  if (d2 - d1 < THRESHOLDS.deltaEMargin) flags.push("classes_too_close")

  const retake = flags.some((f) =>
    f === "card_missing" ||
    f === "patch_too_small" ||
    f === "clipping" ||
    f === "glare" ||
    f === "patch_uneven" ||
    f === "kit_uneven" ||
    f === "card_inconsistent",
  )
  const colourInconclusive = flags.some((f) => f === "far_from_all_refs" || f === "classes_too_close")

  let result: ResultLabel = "inconclusive"
  if (!retake && !colourInconclusive) {
    if (nearest === "positive") result = "positive"
    else if (nearest === "negative") result = "negative"
    else result = "inconclusive"
  }

  const measurementQuality = retake ? "retake" : result === "inconclusive" ? "inconclusive" : "valid"

  const patchLabs = {} as Record<PatchId, Lab>
  const patchRgb = {} as Record<PatchId, Rgb8>
  for (const p of patches) {
    patchLabs[p.id] = rgb8ToLab(p.medianRgb)
    patchRgb[p.id] = p.medianRgb
  }

  return {
    result,
    presumptive: true,
    debug: {
      method,
      kitLab,
      kitHsv,
      kitRgb: kit.medianRgb,
      kitClipFraction: kit.clipFraction,
      kitGlareFraction: kit.glareFraction,
      chroma: chroma(kitLab),
      chromaticity: chromaticity(kitLin),
      deltaE,
      qualityFlags: unique(flags),
      patchLabs,
      patchRgb,
      ccmResidual: ccm?.residualRms ?? null,
      measurementQuality,
    },
  }
}

function minPairwiseDeltaE(labs: Lab[]): number {
  let min = Infinity
  for (let i = 0; i < labs.length; i++) {
    for (let j = i + 1; j < labs.length; j++) min = Math.min(min, deltaE76(labs[i], labs[j]))
  }
  return min
}

function byId<T extends { id: PatchId }>(rows: T[], id: PatchId): T {
  const row = rows.find((r) => r.id === id)
  if (!row) throw new Error(`missing patch ${id}`)
  return row
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

export { intendedPatchXyz }
