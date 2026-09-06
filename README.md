# SIH26231 — Digital Companion for Field Drug Testing

Working web prototype for **NCB / Ministry of Home Affairs** (Smart SNU Hackathon 2026 → SIH 2026, PS **SIH26231**).

Photograph a simulated colorimetric kit with a six-square colour card in frame. The app corrects lighting, classifies **presumptive** positive / negative / inconclusive, and seals the JPEG (time, GPS, officer ID, SHA-256, ECDSA). Searchable log.

**We are not detecting drugs. We are detecting a colour fairly, then locking the photo.**

Not a lab. Not proof of possession. Simulated kit only.

**Repo:** https://github.com/aravarav0/narcoticsssh  
**Hand-in packet:** folder `SUBMIT-SSH-2026/` (pitch, SIH portal text, source zip, demo card).

## Run

```bash
cd app
npm install
npm run dev
```

Open https://localhost:5173/ — allow camera and location. Login e.g. `NCB-DEMO-01`.  
`npm test` runs the colour-math checks.

Phone: same Wi‑Fi, open the terminal **Network** `https://…:5173/` address. Safari: Show Details → Visit this website.

## Maps to the official four bullets

1. Camera capture with a reference colour card in-frame (auto-finds the six squares).
2. Classify positive / negative / inconclusive (CIE Lab ΔE after a colour-correction matrix).
3. Tamper-evident record: timestamp, GPS, operator ID, SHA-256 of the image, digital signature.
4. Searchable on-device log.

No new hardware, no CNN, no blockchain.

## Demo

Physical: printed `colour-card.html` (matte) + purple / white paper as a simulated kit.  
Fallback: on-screen Demo purple / white / black buttons.

## Submission files

See `SUBMIT-SSH-2026/START-HERE.md`.
