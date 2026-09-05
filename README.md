# SIH26231 — Digital Companion for Field Drug Testing

Overnight SSH 2026 prototype for **NCB / Ministry of Home Affairs**. Web app: photograph a simulated colorimetric kit with a colour card in frame, classify presumptive positive / negative / inconclusive, seal the JPEG (time, GPS, officer ID, SHA-256), searchable log.

**Not a lab. Not proof of possession. Simulated kit only.**

Repo: https://github.com/aravarav0/narcoticsssh

## Run the app

```bash
cd app
npm install
npm run dev
```

Open http://localhost:5173/ — allow camera and location. `npm test` runs the colour-math checks.

Paste `CONTEXT.md` into Cursor/Claude before writing code. Lead merges. Do not add chatbots, blockchain, CNNs, or extra screens tonight.

## Team

Clone this repo (do not start a second one):

```bash
git clone https://github.com/aravarav0/narcoticsssh.git
cd narcoticsssh
```

Work on a branch, then open a pull request — or push to `main` only if the Lead said so.
