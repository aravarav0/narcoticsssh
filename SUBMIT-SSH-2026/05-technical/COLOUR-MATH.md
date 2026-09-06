# SIH26231 colour math — what the app actually does

This is the pipeline in `app/src/color/`. It does **not** identify a drug. It reads a colour after correcting the lamp, then says positive / negative / inconclusive. Lab confirmation is still required.

Spoken line: *We are not detecting drugs. We are detecting a colour fairly, then locking the photo.*

---

## 1. Are the card colours accurate enough?

**Yes for this hackathon**, if you treat the card as a *lighting reference*, not as a forensic NIK wall chart.

| Patch | Intended sRGB | CIE Lab (D65, after IEC sRGB) | Why it is on the card |
| --- | --- | --- | --- |
| White | 255, 255, 255 | L* 100, a* 0, b* 0 | Highlights + white point |
| Black | 0, 0, 0 | L* 0, a* 0, b* 0 | Shadows; contrast check |
| Gray | 128, 128, 128 | L* 53.6, a* 0, b* 0 | Illuminant / von Kries fallback |
| Red | 224, 32, 32 | L* 48.2, a* 69.2, b* 50.5 | Chromatic axis (a*) |
| Yellow | 240, 208, 32 | L* 83.8, a* −4.4, b* 80.2 | Chromatic axis (b*) |
| Purple | 112, 48, 160 | L* 34.2, a* 48.3, b* −49.3 | Same hue family as demo **positive** |

Six patches are enough to fit a 3×3 colour-correction matrix. A Macbeth 24-patch chart would be nicer in a lab; it will not change the demo story tonight.

**What is not accurate:** a hostel/inkjet print of those RGB numbers. Printers crush saturated purple and red. Typical print error is ΔE **8–20** on purple — larger than a “just noticeable” difference (~2.3), smaller than our class gap (~89 between pale and purple). So:

1. Do **not** chase a more perfect RGB list tonight.
2. Do **print matte** (no laminate). Gloss = glare = the app refuses.
3. **Save your print as the benchmark** in the app (result screen → “Save these 6 squares as my printed card”, then save your real purple as POSITIVE). That replaces factory sRGB with *your* paper.

Fill the overlay boxes. A perfect card in the wrong place is worse than a slightly wrong print in the right place.

---

## 2. Pipeline (one photo)

```
JPEG / camera frame
  → sample 6 card boxes + 1 kit box (inner 70% of each box, median RGB)
  → quality flags (size, clip, glare, card present)
  → linearise sRGB (IEC 61966-2-1, not γ=2.2)
  → fit 3×3 CCM: observed linear RGB → intended XYZ
       if residual RMS > 0.08 → von Kries on the gray square only
  → kit colour in CIE Lab
  → ΔE76 to three class centres (negative / positive / muddy)
  → call, or refuse (inconclusive)
```

Code: `classify.ts`, `srgb.ts`, `ccm.ts`, `roi.ts`, `constants.ts`, `card.ts`.

---

## 3. Sampling

Each overlay rectangle is converted to pixels, then **shrunk 15% on every side** so the gold border and fingers leak less.

- Colour used = **median** R, G, B (not the mean — median ignores a few glare pixels).
- **Glare pixel:** R, G and B all ≥ **250**.
- **Clipped channel:** value ≤ **2** or ≥ **253**.
- Need at least **30** pixels in a box after shrink.

---

## 4. Linear sRGB (IEC 61966-2-1)

Encoded channel `c` is 0–255. `s = c/255`.

- if `s ≤ 0.04045`: `linear = s / 12.92`
- else: `linear = ((s + 0.055) / 1.055) ^ 2.4`

Do not use ` (c/255)^2.2 `. The tests check the 128-gray toe (`linear ≈ 0.21586`).

Then linear RGB → XYZ with the IEC matrix (D65, Y(white)=1):

```
X = 0.4124 R + 0.3576 G + 0.1805 B
Y = 0.2126 R + 0.7152 G + 0.0722 B
Z = 0.0193 R + 0.1192 G + 0.9505 B
```

XYZ → CIE Lab with D65 white `(0.95047, 1, 1.08883)` and the standard `f(t)` (ε = 216/24389, κ = 24389/27).

---

## 5. Lighting correction

### Colour-correction matrix (preferred)

Six observed patch RGBs (linear) vs six **intended** XYZs (factory `CARD_SRGB`, or your saved print-run RGBs).

Solve least squares:

`[R G B] × M = [X Y Z]`

`M` is 3×3. Residual = RMS of the 18 errors (6 patches × 3 XYZ).

- If `M` is singular, or residual RMS **> 0.08** → flag `ccm_unstable`, use von Kries.
- Else apply `M` to the kit’s linear RGB → XYZ → Lab.

### von Kries fallback

Using the **gray** square only, in linear RGB:

`gain = target_gray / observed_gray` per channel  
`kit_corrected = kit * gain`

This removes a yellow lamp on gray. It will **not** turn pale lavender into factory purple. That is why a weak CCM + un-saved print looked “inconclusive” even when your eyes saw purple.

---

## 6. Classification (ΔE76)

```
ΔE76 = sqrt( (L1-L2)² + (a1-a2)² + (b1-b2)² )
```

This is CIE 1976, not CIEDE2000. Good enough to separate pale vs purple; not a vision-science contest.

### Factory class centres (until you save your own)

| Class | Lab (L*, a*, b*) | Meaning |
| --- | --- | --- |
| Negative | 86.0, 0.4, 4.5 | Unused / pale strip |
| Positive | 34.2, 48.3, −49.3 | Factory purple `112,48,160` |
| Muddy | 52.0, 8.0, 22.0 | Mixed / dirty / brown-yellow |

Gaps at factory colours:

| Pair | ΔE76 |
| --- | --- |
| positive ↔ negative | **88.7** |
| positive ↔ muddy | **83.8** |
| negative ↔ muddy | **39.0** |

After you tap **This kit is my POSITIVE**, the positive centre becomes *that photo’s* corrected kit Lab (your printed lavender), not factory 112,48,160.

---

## 7. Error margins (thresholds)

All in `app/src/color/constants.ts`. Prefer **inconclusive** over a wrong positive.

| Name | Value | What it means | If it fails |
| --- | --- | --- | --- |
| `deltaEMax` | **28** | Nearest class must be within 28 ΔE | `far_from_all_refs` → inconclusive |
| `deltaEMargin` | **6** | 2nd-nearest must be ≥ 6 farther than 1st | `classes_too_close` → inconclusive |
| `ccmResidualMax` | **0.08** | CCM fit quality (XYZ RMS) | `ccm_unstable` → von Kries (not fatal) |
| `glareFractionMax` | **5%** | Kit pixels with R,G,B ≥ 250 | `glare` → inconclusive |
| `clipFractionMax` | **8%** | Kit / chromatic patches clipped | `clipping` → inconclusive |
| `minPatchPixels` | **30** | Too few pixels in a box | `patch_too_small` → inconclusive |
| `minWhiteMinusBlackL` | **15** | White L* minus black L* | `card_missing` → inconclusive |
| `minChromaticPatchChroma` | **8** | Red, yellow **and** purple all dull | `card_missing` → inconclusive |

**Fatal flags** (force inconclusive, even if purple looks close):  
`card_missing`, `patch_too_small`, `clipping`, `glare`, `far_from_all_refs`, `classes_too_close`.

`ccm_unstable` is **not** fatal. The app still calls, but lighting correction is weaker.

### How to read ΔE as a human

| ΔE76 | Rough meaning |
| --- | --- |
| ~0–2 | Same colour to a careful eye |
| ~5–10 | Clearly different, still “that hue” |
| **28** | Our “too far, refuse” radius |
| **~89** | Factory pale vs factory purple — huge on purpose |

Your failed photo was ΔE **56** to positive and **31** to muddy: the kit box was not filled with purple, so the sample was not in any class’s 28-radius.

---

## 8. Confidence score (display only)

Does **not** change the call.

```
score = 100 − 2×d1 − 8×max(0, 6 − (d2−d1)) − (any flags ? 35 : 0)
```

clamped 0–100.

- ≥ 75 → high  
- ≥ 45 → moderate  
- else → low  

`d1` = ΔE to nearest class, `d2` = ΔE to second.

---

## 9. What we are *not* claiming

- Not ΔE2000, not a spectrophotometer, not SWGDRUG Category A.
- Not matching a NIK/Sirchie drug-colour poster.
- SHA-256 + ECDSA seal the **record**. They do not make the colour call more accurate.

Tonight, accuracy comes from: **matte card in the boxes + save print-run + save your purple as positive + no glare.**
