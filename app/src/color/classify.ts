import { CARD_SRGB, PATCH_ORDER } from "./card"
import { applyCcm, fitCcm, intendedPatchXyz, vonKries } from "./ccm"
import type { ClassModel } from "./classModel"
import { DEFAULT_LAYOUT, THRESHOLDS } from "./constants"
import { rgb8ToHsv } from "./hsv"
import { FLAG_REASON, OPTICAL_FLAGS } from "./reasons"
import { overlayBounds, sampleKit, samplePatch } from "./roi"
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
  PatchStats,
  PixelBuffer,
  QualityFlag,
  ResultLabel,
  Rgb8,
} from "./types"

export type { ClassModel }

/**
 * Decision order (do not invert):
 * 1. Capture quality and card consistency → retake, no class call
 * 2. Per-photo colour correction
 * 3. Class distance and class-margin checks (needs a multi-sample model)
 * 4. Positive, negative, or inconclusive
 *
 * `cardBaselineRgb` is a controlled JPEG baseline of this physical print, not a
 * spectrophotometer reading. `printRunRgb` is kept as an alias for older callers.
 * CARD_SRGB is only the demo fallback.
 */
export function classifyImage(
  image: PixelBuffer,
  opts?: {
    layout?: Layout
    classModel?: ClassModel | null
    cardBaselineRgb?: Record<PatchId, Rgb8>
    /** @deprecated Use cardBaselineRgb. Same bytes; not physical ground truth. */
    printRunRgb?: Record<PatchId, Rgb8>
  },
): ClassifyOutput {
  const layout = opts?.layout ?? DEFAULT_LAYOUT
  const targets = opts?.cardBaselineRgb ?? opts?.printRunRgb ?? CARD_SRGB
  const classModel = opts?.classModel ?? null
  const flags: QualityFlag[] = []

  const patches = PATCH_ORDER.map((id) => samplePatch(image, id, layout.patches[id]))
  const kit = sampleKit(image, layout.kit)
  const overlay = sampleKit(image, overlayBounds(layout))

  for (const p of patches) {
    if (p.pixelCount < THRESHOLDS.minPatchPixels) flags.push("patch_too_small")
    const unevenColour = p.rgbStddev > THRESHOLDS.maxRoiRgbStddev
    const unevenUsable =
      p.id !== "white" && p.id !== "black" && p.usableFraction < THRESHOLDS.minUsableFraction
    if (unevenColour || unevenUsable) flags.push("patch_uneven")
    if (p.id !== "white" && p.id !== "black" && p.clipFraction > THRESHOLDS.clipFractionMax) {
      flags.push("clipping")
    }
  }
  if (kit.pixelCount < THRESHOLDS.minPatchPixels) flags.push("patch_too_small")
  if (kit.clipFraction > THRESHOLDS.clipFractionMax) flags.push("clipping")
  if (kit.glareFraction > THRESHOLDS.glareFractionMax) flags.push("glare")
  if (kit.rgbStddev > THRESHOLDS.maxRoiRgbStddev || kit.usableFraction < THRESHOLDS.minUsableFraction) {
    flags.push("patch_uneven")
  }
  if (overlay.laplacianVariance < THRESHOLDS.minOverlayLaplacianVariance) flags.push("kit_blur")

  const whiteLab = rgb8ToLab(byId(patches, "white").robustRgb)
  const grayLab = rgb8ToLab(byId(patches, "gray").robustRgb)
  const blackLab = rgb8ToLab(byId(patches, "black").robustRgb)
  if (whiteLab.L - blackLab.L < THRESHOLDS.minWhiteMinusBlackL) flags.push("card_missing")
  if (
    whiteLab.L - grayLab.L < THRESHOLDS.minLightnessStepL ||
    grayLab.L - blackLab.L < THRESHOLDS.minLightnessStepL
  ) {
    flags.push("card_alignment")
  }

  const redLab = rgb8ToLab(byId(patches, "red").robustRgb)
  const yellowLab = rgb8ToLab(byId(patches, "yellow").robustRgb)
  const purpleLab = rgb8ToLab(byId(patches, "purple").robustRgb)
  const chromatic = [redLab, yellowLab, purpleLab].map((lab) => chroma(lab))
  if (chromatic.every((c) => c < THRESHOLDS.minChromaticPatchChroma)) flags.push("card_missing")
  const pairDelta = [deltaE76(redLab, yellowLab), deltaE76(redLab, purpleLab), deltaE76(yellowLab, purpleLab)]
  if (pairDelta.some((d) => d < THRESHOLDS.minChromaticPairDeltaE)) flags.push("card_alignment")

  const usablePatches = patches.filter(
    (p) =>
      p.pixelCount >= THRESHOLDS.minPatchPixels &&
      p.clipFraction <= THRESHOLDS.clipFractionMax &&
      p.rgbStddev <= THRESHOLDS.maxRoiRgbStddev &&
      p.usableFraction >= THRESHOLDS.minUsableFraction,
  )

  const observed = usablePatches.map((p) => p.robustRgb)
  const targetXyz = usablePatches.map((p) => linearToXyz(rgb8ToLinear(targets[p.id])))
  const ccm = observed.length >= 3 ? fitCcm(observed, targetXyz) : null

  let method: "ccm" | "von_kries" | "none" = "none"
  let kitLab: Lab | null = null
  let kitLin = rgb8ToLinear(kit.robustRgb)
  let correctionNote: string | null = null

  const grayOk = usablePatches.some((p) => p.id === "gray")
  if (ccm && ccm.residualRms <= THRESHOLDS.ccmResidualMax) {
    method = "ccm"
    const xyz = applyCcm(kitLin, ccm.M)
    kitLab = xyzToLab(xyz)
    kitLin = xyzToLinear(xyz)
  } else if (grayOk) {
    method = "von_kries"
    correctionNote = ccm
      ? "CCM residual above gate; used gray-patch von Kries. Card baseline is a controlled JPEG, not physical ground truth."
      : "CCM not fitted with enough valid patches; used gray-patch von Kries."
    const grayObs = rgb8ToLinear(byId(patches, "gray").robustRgb)
    const grayTgt = rgb8ToLinear(targets.gray)
    kitLin = vonKries(kitLin, grayObs, grayTgt)
    kitLab = xyzToLab(linearToXyz(kitLin))
  } else {
    flags.push("ccm_unstable")
    correctionNote = "No usable gray patch; colour correction skipped."
  }

  const opticalFail = unique(flags).some((f) => OPTICAL_FLAGS.includes(f))
  const qualityStatus = opticalFail ? "retake" : "valid"

  const patchLabs = {} as Record<PatchId, Lab>
  const patchRgb = {} as Record<PatchId, Rgb8>
  for (const p of patches) {
    patchLabs[p.id] = rgb8ToLab(p.robustRgb)
    patchRgb[p.id] = p.robustRgb
  }

  const baseDebug = {
    kitRgb: kit.robustRgb,
    kitClipFraction: kit.clipFraction,
    kitGlareFraction: kit.glareFraction,
    kitRgbStddev: kit.rgbStddev,
    kitUsableFraction: kit.usableFraction,
    kitLaplacianVariance: kit.laplacianVariance,
    overlayLaplacianVariance: overlay.laplacianVariance,
    qualityFlags: unique(flags),
    patchLabs,
    patchRgb,
    ccmResidual: ccm?.residualRms ?? null,
    classModelReady: !!classModel?.ready,
    correctionNote,
  }

  if (qualityStatus === "retake" || !kitLab) {
    return finish({
      result: "inconclusive",
      status: "retake",
      qualityStatus: "retake",
      flags,
      debug: {
        ...baseDebug,
        method,
        kitLab,
        kitHsv: kitLab ? rgb8ToHsv(kit.robustRgb) : null,
        chroma: kitLab ? chroma(kitLab) : null,
        chromaticity: kitLab ? chromaticity(kitLin) : null,
        deltaE: null,
        classRadii: null,
      },
    })
  }

  const kitHsv = rgb8ToHsv(linearToRgb8(kitLin))

  if (!classModel?.ready || !classModel.positive || !classModel.negative) {
    flags.push("calibration_incomplete")
    return finish({
      result: "inconclusive",
      status: "inconclusive",
      qualityStatus: "valid",
      flags,
      debug: {
        ...baseDebug,
        method,
        kitLab,
        kitHsv,
        chroma: chroma(kitLab),
        chromaticity: chromaticity(kitLin),
        deltaE: null,
        classRadii: null,
        qualityFlags: unique(flags),
        classModelReady: false,
      },
    })
  }

  const deltaE = {
    negative: deltaE76(kitLab, classModel.negative.center),
    positive: deltaE76(kitLab, classModel.positive.center),
    muddy: classModel.muddy ? deltaE76(kitLab, classModel.muddy.center) : Number.POSITIVE_INFINITY,
  }
  const classRadii = {
    negative: classModel.negative.radius,
    positive: classModel.positive.radius,
    muddy: classModel.muddy?.radius ?? null,
  }

  const ranked = (Object.entries(deltaE) as [keyof typeof deltaE, number][])
    .filter(([, d]) => Number.isFinite(d))
    .sort((a, b) => a[1] - b[1])
  const [nearest, d1] = ranked[0]
  const d2 = ranked[1]?.[1] ?? Number.POSITIVE_INFINITY

  const nearestRadius =
    nearest === "positive"
      ? classModel.positive.radius
      : nearest === "negative"
        ? classModel.negative.radius
        : (classModel.muddy?.radius ?? THRESHOLDS.deltaEMax)

  if (d1 > nearestRadius || d1 > THRESHOLDS.deltaEMax) flags.push("outside_trained_range")
  if (d1 > THRESHOLDS.deltaEMax) flags.push("far_from_all_refs")
  if (d2 - d1 < THRESHOLDS.deltaEMargin) flags.push("classes_too_close")

  const classFail = unique(flags).some(
    (f) => f === "outside_trained_range" || f === "far_from_all_refs" || f === "classes_too_close",
  )

  let result: ResultLabel = "inconclusive"
  if (!classFail && nearest === "positive") result = "positive"
  else if (!classFail && nearest === "negative") result = "negative"

  return finish({
    result,
    status: result === "inconclusive" ? "inconclusive" : "valid",
    qualityStatus: "valid",
    flags,
    debug: {
      ...baseDebug,
      method,
      kitLab,
      kitHsv,
      chroma: chroma(kitLab),
      chromaticity: chromaticity(kitLin),
      deltaE: {
        negative: deltaE.negative,
        positive: deltaE.positive,
        muddy: Number.isFinite(deltaE.muddy) ? deltaE.muddy : -1,
      },
      classRadii,
      qualityFlags: unique(flags),
    },
  })
}

function finish(input: {
  result: ResultLabel
  status: ClassifyOutput["status"]
  qualityStatus: ClassifyOutput["qualityStatus"]
  flags: QualityFlag[]
  debug: ClassifyOutput["debug"]
}): ClassifyOutput {
  const flags = unique(input.flags)
  const reasons = flags.map((f) => FLAG_REASON[f])
  return {
    result: input.result,
    status: input.status,
    qualityStatus: input.qualityStatus,
    reasons: unique(reasons),
    presumptive: true,
    debug: { ...input.debug, qualityFlags: flags },
  }
}

function byId(rows: PatchStats[], id: PatchId): PatchStats {
  const row = rows.find((r) => r.id === id)
  if (!row) throw new Error(`missing patch ${id}`)
  return row
}

function unique<T>(xs: T[]): T[] {
  return [...new Set(xs)]
}

export { intendedPatchXyz }
