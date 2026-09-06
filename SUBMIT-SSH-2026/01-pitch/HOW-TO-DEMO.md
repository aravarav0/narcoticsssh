# 3-minute live demo (SSH)

Laptop on `https://localhost:5173/` (or the Network address on the phone). Allow camera + location.

**Login:** `NCB-DEMO-01` → **Start capture**.

If the room camera is awkward, use the on-screen **Demo purple / Demo white / Demo black** buttons. Same pipeline as a real photo.

## Script (keep it under 3:00)

1. **Problem (20s).** Field kits are a colour change. Streetlight vs tube light, two officers, two answers. No sealed record.
2. **Idea (15s).** We did not invent a new kit. Card + kit in one photo. Phone corrects the light, names the colour, locks the photo.
3. **Positive (40s).** Purple sheet + card in frame → capture. Point at: kit colour PURPLE, POSITIVE, ΔE bars, PRESUMPTIVE banner. Tap **Show corrected** so they see lighting removed.
4. **Negative (20s).** White / unused sheet → NEGATIVE.
5. **Inconclusive (20s).** Wrong colour (black / green) → INCONCLUSIVE. “When it is not sure, it refuses.”
6. **Seal (40s).** Seal this photo → time, GPS, officer ID, SHA-256. **Flip one byte** → hash jumps. **Verify signature** → green. Open **Log**, search purple.
7. **Close (15s).** *We are not detecting drugs. We are detecting a colour fairly, then locking the photo.*

## If something breaks

- iPhone live camera wants `https://` (not `http://`). Use **Take photo** — it still classifies.
- Gold boxes missed the card: get yellow + purple card squares clearly in frame, retake.
- No GPS: still seal; location can stay empty. Hash still works.
- Say **presumptive** out loud once. Never say “admissible in court” or “proof of possession.”
