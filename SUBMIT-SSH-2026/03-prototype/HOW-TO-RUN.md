# How to run the prototype

Repo: https://github.com/aravarav0/narcoticsssh

```bash
git clone https://github.com/aravarav0/narcoticsssh.git
cd narcoticsssh/app
npm install
npm run dev
```

Open **https://localhost:5173/** (the project uses a local HTTPS cert so iPhones can use the camera).

- Laptop: that localhost URL.
- Phone on the same Wi‑Fi: use the **Network** `https://…:5173/` address printed in the terminal. Safari → Show Details → Visit this website.
- `npm test` runs the colour-math checks.

**Login:** any officer ID, e.g. `NCB-DEMO-01`.

**Demo without a camera:** Capture screen → Demo purple / Demo white / Demo black.

**Print the card:** open `colour-card.html` in this folder, print matte A4, do not laminate.

No backend. No API keys. Data stays in the browser (`localStorage`).
