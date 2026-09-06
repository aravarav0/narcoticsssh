# SIH26231 — 3-minute demo video script

**Problem statement:** SIH26231 · Digital Companion for Field Drug Testing · NCB · Ministry of Home Affairs
**Golden line (say it twice):** *"We are not detecting drugs. We are detecting a colour fairly, then locking the photo."*

Total ~3:00. Two speakers max. Screen-record the app on `http://localhost:5173/`. Keep the physical card + a coloured "kit" sheet ready.

Timing target: ~150 words per minute. Do not read bullets — talk to the camera, let the app do the proving.

---

## 0:00 – 0:25 · Hook + problem (Speaker A, on camera)
> "A field drug kit works by changing colour. Today an officer holds it up and *decides* — purple or not? Under a streetlight, a tube light, or dusk, the same purple looks different. Two officers, two answers. And the only record is a line in a notebook that could be written an hour later."

On screen: NCB's own words (slide) —
> "*subjective… difficult to standardise… no verifiable record… cannot presently be relied upon as documentary evidence.*"

> "We didn't invent a new kit. We gave the existing kit a fair witness — a phone."

## 0:25 – 0:45 · The idea in one breath (Speaker A)
> "One pocket colour card lives inside the kit. You photograph the kit and the card in the same frame. The app uses the card to cancel the lighting, names the colour, calls it Positive, Negative, or Inconclusive — and seals that photo so it can't be quietly changed later."

On screen: capture screen with the FILL KIT + card overlay.

## 0:45 – 1:35 · Live demo (Speaker B drives the app)
Do these clicks slowly. Say what you click.

1. **Login** as Officer NCB-DEMO-01 → Start capture.
2. Show the **lavender / purple** kit sheet in frame with the card. Capture.
   > "The app corrected the light from the six card squares, read the kit as **PURPLE**, and matched it to the positive reference — the same paper as the purple square on the card. Presumptive positive."
3. Point to **Kit colour** + **ΔE bars** + **confidence**.
   > "It's not a black box or a neural net — it shows the colour distance to each reference. Lower is closer."
4. Swap to the **white / unused** sheet → capture → **Negative**.
5. Show a **wrong colour** (black or green) → **Inconclusive**.
   > "This is the important part: when it isn't sure, it refuses. Inconclusive is a feature, not a failure. Guessing would be the unethical product."

## 1:35 – 2:10 · The sealed record (Speaker B)
1. On a result, tap **Seal this photo** → open the record.
   > "Every test stores the photo, the result marked *presumptive*, an ISO timestamp, GPS, officer ID, a SHA-256 of the image, and a digital signature."
2. Tap **Flip one byte — hash must change**.
   > "Watch the hash. We change a single pixel and the hash jumps. That's the wax seal — tamper is visible."
3. Tap **Verify digital signature** → green tick. Open **Log**, search by colour.
   > "It's a searchable, verifiable log — the documentary evidence NCB said was missing."

## 2:10 – 2:40 · Why it wins (Speaker A, on camera)
> "It's feasible today: existing kits, any phone browser, a card that costs almost nothing, no new hardware. It's honest: presumptive only, lab confirmation still required. And it's fair: the same photo gives the same call, whoever is holding it."

On screen: quick flash of the pipeline diagram (card → linearise → colour-correct → ΔE → call + seal).

## 2:40 – 3:00 · Close (Speaker A)
> "We are not detecting drugs. We are detecting a colour fairly, then refusing to let that photo become a rumour. SIH26231 — a phone witness for the kit that's already in every officer's pocket. Thank you."

End card: `SIH26231 · Team [NAME] · NCB · Ministry of Home Affairs`

---

## Shot checklist (record before you narrate)
- [ ] Capture screen with card + kit overlay
- [ ] Positive (purple / lavender) result — colour name + hex visible
- [ ] Negative (white) result
- [ ] Inconclusive (black/green) result
- [ ] Record page: hash + GPS + time + signature
- [ ] "Flip one byte" hash change
- [ ] Verify signature = green
- [ ] Log search by colour

## Rules
- Say "presumptive" out loud at least once. Keep it on the result screen.
- Simulated kit only (pH strip / food colour / craft paper). No real narcotics. Label it on screen.
- If live camera fails on the day, use the Demo purple / white / black buttons — same pipeline.
