# SIH26231 — what to hand in

**Problem:** SIH26231 · Digital Companion for Field Drug Testing  
**Org:** Narcotics Control Bureau · Ministry of Home Affairs  
**Category:** Software · Theme: MedTech / HealthTech  
**Code:** https://github.com/aravarav0/narcoticsssh  
**Spoken line:** *We are not detecting drugs. We are detecting a colour fairly, then locking the photo.*

This folder is the packet. Put your **team name** on the two PPTX files (footer still says `[TEAM NAME]`) before you upload.

---

## For Smart SNU Hackathon (today)

Give judges / the Google Form:

| # | File | What it is |
|---|---|---|
| 1 | `01-pitch/SIH26231-SSH-pitch.pptx` | Sunday pitch deck |
| 2 | GitHub link above | Working prototype |
| 3 | `01-pitch/HOW-TO-DEMO.md` | 3-minute live path |
| 4 | `03-prototype/sih26231-field-companion-source.zip` | Source (if they want a zip, not only GitHub) |
| 5 | Your demo video (if you recorded one) | Drop it in `01-pitch/` and name it `SIH26231-demo.mp4` |

Print `03-prototype/colour-card.html` if you need a spare card. Simulated kit only — no real narcotics.

---

## For the SIH.gov.in portal (after SSH, deadline 20 Sep 2026)

| # | File | Paste / upload |
|---|---|---|
| 1 | `02-sih-portal/IDEA-TITLE.txt` | Idea title |
| 2 | `02-sih-portal/IDEA-DESCRIPTION.txt` | Idea description |
| 3 | `02-sih-portal/SIH26231-idea-6slide.pptx` | Convert to **PDF** first, then upload as idea presentation |

Do **not** upload the SSH pitch PPT to sih.gov.in. They want the 6-slide government idea format only.

---

## What this product is (one paragraph)

Officers already have a colour-change field kit. This web app photographs the kit **with a six-square colour card in the same frame**, corrects the lighting from that card, names the colour, calls **positive / negative / inconclusive**, and seals the JPEG (timestamp, GPS, officer ID, SHA-256, ECDSA signature). Presumptive only — it does not replace a lab.
