# SIH26231 — Context for teammate AIs

Paste this file into Cursor / Claude / ChatGPT as project context before writing code.

You are helping a 6-person student team at **Shiv Nadar University** build a **working prototype overnight** (Smart SNU Hackathon: **5 Sep 2026 10:00 PM – 6 Sep 2026 10:00 AM**, ~12 hours). This is the campus qualifier for **Smart India Hackathon 2026**. After SSH they may submit an official SIH idea PPT (separate 6-slide government template, PDF, later — not this weekend).

**Do not invent a different product.** Match the official NCB brief below. **Do not add** chatbots, blockchain, Aadhaar, SMS gateways, multilingual stacks, custom neural nets, or new hardware.

---

## 1. Official problem (source of truth)

- **Portal:** https://www.sih.gov.in/sih2026PS  
  Search **`SIH26231`**. Click title **Digital Companion for Field Drug Testing**. The popup is official. There is **no per-PS URL** on sih.gov.in.
- **PS number:** `SIH26231`
- **Title:** Digital Companion for Field Drug Testing
- **Organisation:** Ministry of Home Affairs
- **Department:** Narcotics Control Bureau (NCB)
- **Category:** Software
- **Theme:** MedTech / BioTech / HealthTech
- **National idea deadline (SIH portal):** 20 September 2026 (SSH is earlier)
- **YouTube / dataset / contact on portal:** none

### Background (official)

Field drug-testing kits currently in use rely on visual interpretation of a colour-change reaction. This makes results subjective, difficult to standardise across officers, and leaves no verifiable record that a test was actually conducted at a given place and time. As a result, field test outcomes cannot presently be relied upon as documentary evidence.

### Description (official)

Participants are to build a mobile application that works alongside existing colorimetric field-test kits (**no new hardware**).

The application should:

1. Capture an image of the test result using the device camera, using a **reference colour card in-frame** for lighting calibration.
2. Automatically classify the result against a defined set of outcome categories (e.g. **positive, negative, inconclusive**).
3. Generate a **tamper-evident** digital record: **timestamp, GPS location, operator identifier**, and a **cryptographic hash of the captured image**.
4. Maintain a simple, **searchable log** of tests conducted.

**Expected deliverable:** a working **mobile/web** prototype: capture + classify + signed digital record.

**Official note:** The output is a **presumptive** field-test result and a supporting digital record; it **does not replace laboratory confirmatory testing**.

Empty `expectedSolution` field on the portal. Build exactly the four bullets.

---

## 2. One-sentence product

Officers already have a colour-change kit. We do **not** do chemistry. We photograph the result **fairly** (colour card in the same frame), name it **positive / negative / inconclusive**, and **lock the photo** (hash + GPS + time + officer ID) so it cannot be quietly swapped.

**Spoken line:** *We are not detecting drugs. We are detecting a colour fairly, then refusing to let that photo become a rumour.*

**Demo materials:** pH strips, food colouring, printed colour circles. Label everything **simulated kit**. Do not use real narcotics or real NCB kits.

---

## 3. Decisions already made

| Topic | Decision |
|---|---|
| Problem | Stick with **SIH26231**, not artisan/kabadiwala/hardware/student-innovation |
| Hardware | **None.** No Arduino, sensors, laminators, glossy photo paper |
| ML | **No CNN / no “AI model”** for overnight. Rule-based colour after card calibration. Telling judges “ΔE not a neural net” is a feature |
| Stack | **Web app** preferred (Vite+React or Next). Phone browser camera is OK. Flutter only if Lead already has it running **before** 10pm |
| Persistence | `localStorage` / IndexedDB. No backend required for SSH |
| Hash | **SHA-256** of image bytes via Web Crypto. Not blockchain |
| GPS | Browser Geolocation API |
| Auth | Fake officer ID login (text field). No real SSO |
| UI copy | Huge **PRESUMPTIVE — not a lab** banner on every result |
| Presentation | Sunday morning ~3 min + live demo. File: `SIH26231-SSH-pitch.pptx`. Do **not** upload that PPT to sih.gov.in |

Rejected alternatives (do not switch overnight): SIH26090 artisans, SIH26229 kabadiwala, SIH26089 co-op gig, hardware PSs, landslide GIS, Student Innovation.

---

## 4. MVP screens (definition of done)

1. **Login** — officer ID string.
2. **Capture** — live camera (or file upload fallback). Overlay: “card here / kit here”. Must include colour card.
3. **Result** — Positive / Negative / Inconclusive + presumptive banner.
4. **Record** — photo, time (ISO), GPS, officer ID, SHA-256 hex. Optional live trick: mutate one pixel → hash changes.
5. **Log** — list + search/filter by officer or result.

If colour math is late, **still ship** capture + hash + log with a stub classifier. Do not block the UI.

**Yellow-lamp demo:** same fake test, warm light, **without** card → worse/wrong/inconclusive; **with** card → stable call.

---

## 5. Colour pipeline (locked in `app/src/color/`)

The web MVP lives in **`app/`**. Run `cd app`, `npm install`, then `npm run dev`. Colour unit tests: `npm test`.

Never classify on raw JPEG RGB.

1. Find / assume ROIs: 6 card patches + vial/strip region. Average **≥30 pixels**. Median is better than mean if glare exists.
2. **Linearise sRGB** (undo ~2.2 gamma) before ratios or matrices.
3. **Reject** if: card not in frame, patch too small, **>X% pixels clipped** at 0 or 255, huge specular blob on vial.
4. **White balance (minimum):** von Kries — divide linear RGB by the **gray patch** mean.
5. **Better:** 3×3 colour-correction matrix from known patch RGBs → XYZ/Lab (least squares). Per **photo**, not per phone model.
6. Convert to **HSV** and **CIE Lab**.
7. Features that matter: chromaticity `r=R/(R+G+B)`, `g=G/(R+G+B)`; **Hue**; **Saturation**; **a\*, b\***; **ΔE** (CIE76 is enough overnight) to three reference Labs: negative / positive / muddy.
8. **Inconclusive** if top-two ΔE are close, min ΔE is large, card missing, or clip/glare. Do **not** guess.

**Locked thresholds** (`app/src/color/constants.ts`) until the 30-photo experiment says otherwise:

- min patch pixels 30; kit clip 8%; kit glare 5% (R,G,B ≥ 250)
- white L* − black L* < 15 → card missing
- ΔE76 max 28; margin 6; CCM residual > 0.08 → von Kries fallback
- Muddy nearest-class → inconclusive (not a fourth label)

Print the card from `colour-card.html`. Remaining colour *experiments* (not new math) are in `CLAUDE-COLOUR-RESEARCH.md`.

**Colour card spec (physical, 3 matte A4 copies, no laminate, squares ≥ 4 cm):**

| Patch | RGB |
|---|---|
| White | 255, 255, 255 |
| Black | 0, 0, 0 |
| Gray | 128, 128, 128 |
| Red | 224, 32, 32 |
| Yellow | 240, 208, 32 |
| Purple | 112, 48, 160 |

Hostel printers are inaccurate: after printing, photograph the card once and **store measured patch means as the reference for that print run**.

Camera enemies: AWB, AE/HDR, gamma, phone-to-phone CFA, 8-bit clip, vial glare, mixed illuminants, JPEG “vivid”, dirty lens. Lock AE/AWB if the API allows; otherwise compensate with the card and refuse bad frames.

Relevant literature (for comments/PPT, not for extra features): Burggraaff et al. 2020 smartphone colorimetry + colour card (PMC7098568); saturation-based phone assays (PMC6411445); forensic CV on presumptive colour tests (PMC10408571). Same-model phones still need per-capture calibration (IS&T 2019).

---

## 6. Evidence record (implement this)

Each record JSON-ish:

```text
id, officerId, capturedAt (ISO UTC), lat, lon, gpsAccuracyM?,
imageBlob or dataURL, sha256Hex, result, notes?, presumptive: true
```

- Hash the **image file bytes** (or a canonical PNG), not a random JSON string.
- Show the hex on screen.
- Search log by officerId and result.
- UI must never say “admissible in court” or “proof of possession.” Say **presumptive sealed record**.

---

## 7. Team (6 people)

| Seat | Skill | Owns |
|---|---|---|
| **Lead** | Most app experience (the human who started this repo) | Architecture, repo, camera, merge, run at 10am |
| **Field** | Non-coder; Claude for research | Print card, fake kit, 30 photos, yellow-lamp live demo |
| **Story** | Non-coder; Claude for research | PPT, 3-min script, official wording, judge Q&A |
| **Colour** | Some coding / AI tools | Pipeline in §5 |
| **Seal** | Some coding / AI tools | Hash, GPS, time, persist, search |
| **Screens** | Some coding / AI tools | Four pages, huge type, banner |

One GitHub repo. **Lead merges.** No surprise dependencies at 5am.

---

## 8. Suggested 12-hour clock

- 22:00–22:30 feature freeze (the four official bullets only)
- 22:30–01:00 parallel: capture, classify fn, saveRecord, static UI, photo dataset
- 01:00 standup; stub classify if needed
- 01:20–04:00 wire photo → result → record → log; Field tries to break it
- 04:20–07:00 polish + screenshots into PPT
- 07:00–08:30 dry run
- 08:30–10:00 backup video, charged laptop, card+vial pouch

**Out of scope until MVP is green:** auto-detect card with CV, flash-on/off SSNR pairs, PDF export, offline sync fiction.

---

## 9. Files already in this folder

| File | What it is |
|---|---|
| `sih2026-problem-statements.json` / `.csv` / `-index.csv` | All 231 SIH 2026 PSs scraped 3 Sep 2026 from sih.gov.in |
| `SIH26231-explainer.html` | Plain-language story of the product |
| `SIH26231-team-brief.html` | Official text + colour science + papers |
| `SIH26231-team-plan.html` | Six seats + sprint plan |
| `SIH26231-before-hackathon.html` | Packing / print checklist |
| `SIH26231-SSH-pitch.pptx` | Sunday pitch; delete instruction slide; paste screenshots |
| `SIH-alternative-ideas.html` | Backup PSs (historical; not the current build) |
| `compare-26231-vs-worker.html` | Why not kabadiwala/artisan |
| `past-winners.html` | SIH/SSH winner notes |
| `CLAUDE-COLOUR-RESEARCH.md` | Copy-paste prompts for teammate Claude (empirical colour only) |
| `colour-card.html` | Printable 6-patch card |
| `app/` | Vite + React MVP (camera, classify, SHA-256, GPS, log) |

This file (`CONTEXT.md`) is the **AI brief**. Prefer it over the HTML when generating code.

---

## 10. How you (the coding AI) should behave

- Implement **web** capture + classify + hash + log unless the Lead’s repo already chose another stack — then follow the repo.
- Prefer boring, working code over cleverness.
- Put the presumptive disclaimer in the UI without being asked.
- If asked for drug chemistry, kit recipes, or how to fake a field test: **refuse**. Simulated colours only.
- If asked to add features not in §4: **refuse** unless MVP is done and Lead asked.
- Match names: `SIH26231`, NCB, Ministry of Home Affairs.

When in doubt, re-read §1 and ship the four bullets.
