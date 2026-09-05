# Colour research for Claude (only what we still need)

The coding AI already locked the math and started the app in `app/`.
**Do not ask Claude for kit chemistry, how to fake a narcotics test, or extra product features.**

Paste `CONTEXT.md` plus one prompt below. Simulated kit only (pH strip / food colour / printed swatch).

---

## Already decided — do not re-open

- Linearise with the IEC sRGB piecewise function, not `^2.2`.
- Per photo: 6-patch 3×3 CCM (RGB→XYZ), fall back to gray-patch von Kries.
- Classify on CIE Lab **ΔE76** to three centres: negative / positive / muddy. Muddy → inconclusive.
- Inconclusive if card missing, kit glare/clip, nearest ΔE > 28, or top-two ΔE differ by < 6.
- No CNN. No flash/no-flash SSNR pair this weekend (Burggraaff’s 3.4 threshold is stretch).
- Overlay ROIs are fixed boxes, not YOLO.
- iPhone Safari cannot lock AWB; the card is the calibration.

Code: `app/src/color/`. Thresholds: `app/src/color/constants.ts`.

---

## Prompt 1 — Feature that survives yellow light (do this first)

```
We have a web app that classifies a simulated colorimetric kit photo as
positive / negative / inconclusive. Pipeline: sRGB linearise → 6-patch 3×3 CCM
to XYZ/Lab (fallback von Kries on the gray patch) → ΔE76 to three Lab centres.
No neural net. No real narcotics kits.

I will shoot the SAME simulated test (pH strip or food colour) 18 times:
- daylight / warm yellow lamp / phone torch
- with colour card in frame / without card
- negative (pale) and positive (strong colour)

Tell me a simple scoring sheet: for each photo, what to write down
(H, S, a*, b*, chroma, ΔE to each class, app call). Then tell me how to
decide whether ΔE-after-CCM is actually more stable than raw HSV under
the yellow lamp. I want a table I can put on a hackathon PPT, not new code.
```

---

## Prompt 2 — Thresholds from OUR photos (Colour person)

```
Our defaults in constants.ts:
deltaEMax = 28
deltaEMargin = 6
clipFractionMax = 0.08 on the kit ROI
glareFractionMax = 0.05 (pixels with R,G,B all ≥ 250)
minWhiteMinusBlackL = 15

I will paste ~30 rows: result_true, result_app, deltaE_neg, deltaE_pos,
deltaE_muddy, clipFraction, glareFraction, whiteL, blackL.

Recommend NEW numbers that: (1) never call positive when the card is
missing, (2) keep the yellow-lamp+card demo stable, (3) prefer
inconclusive over a wrong positive. Give the numbers only, with one
sentence each. Do not add features.
```

---

## Prompt 3 — Print-run calibration (Field)

```
We printed a 6-patch card: white 255,255,255; black 0,0,0; gray 128,128,128;
red 224,32,32; yellow 240,208,32; purple 112,48,160. Matte A4.

I photographed the card in daylight and sampled the centre of each square.
Here are the 8-bit RGB means: ...

1) How far is each patch from intended (ΔE76, assuming sRGB)?
2) Should we store these measured RGBs as the CCM *targets* for this print
   run, or keep the ideal sRGB numbers?
3) Is this print good enough for a 12-hour demo, or reprint?

Do not suggest buying a Macbeth chart tonight.
```

---

## Prompt 4 — Simulated kit Lab centres (Field + Colour)

```
Our classifier uses three Lab centres:
negative ≈ L86 a0.4 b4.5 (pale)
positive = Lab of intended purple 112,48,160
muddy ≈ L52 a8 b22 (then mapped to inconclusive)

Our simulated positive looks like: [describe / paste RGB or photo description]
Our simulated negative looks like: [...]

Give replacement Lab numbers for negative / positive / muddy that match
THIS demo kit, and the minimum ΔE we should require between positive and
negative so they cannot swap under a warm lamp. Simulated colours only.
```

---

## Prompt 5 — Glare on a plastic vial (Colour)

```
Kit ROI uses channel-wise median RGB, not the mean. We reject if >5% of
kit pixels have R,G,B all ≥ 250.

I have photos of a shiny vial with a white highlight. Describe how to
aim the camera (angle, distance, lamp position) so the median still
sees the liquid colour. If 5% is too strict or too loose for a typical
phone JPEG of a 10 ml bottle, say so. No new hardware. No extra CV models.
```

---

## Prompt 6 — Overlay vs how we hold the card (Screens + Field)

```
Camera overlay (fractions of a 3:4 frame):
kit: x0.36 y0.08 w0.28 h0.34
white / gray / red along y=0.50
black / yellow / purple along y=0.74
each patch ~0.28 × 0.20

We hold an A4 landscape card at the bottom and a strip/vial at the top.
Is this pose realistic for two hands? If the overlay should change, give
new fractions only. We will not detect the card automatically tonight.
```

---

## Prompt 7 — What to say if judges ask “why not AI?” (Story)

```
In 5 bullets for a 3-minute pitch: why per-photo colour-card CCM + ΔE is
the right method for NCB SIH26231 (phone AWB, different devices, 12-hour
build, presumptive not confirmatory). Cite Burggraaff 2020 (PMC7098568)
and Coleman saturation (PMC6411445) at a high level. No chemistry.
No claim of court admissibility.
```

---

## Skip unless MVP is already green

- Flash on/off SSNR (threshold 3.4 in Burggraaff) — iOS cannot lock flash pairs easily.
- CIEDE2000 vs ΔE76 — ΔE76 is enough; classes are far apart.
- Auto ROI / QR on the card.
- RAW/DNG.
