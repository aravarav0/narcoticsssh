#!/usr/bin/env node
/**
 * Local-only scorer for a filled eval manifest.
 * Usage (from app/): node scripts/evaluate-classify.mjs [path-to-manifest.json]
 */
import { readFileSync } from "node:fs"
import { dirname, resolve } from "node:path"
import { fileURLToPath } from "node:url"

const LABELS = ["positive", "negative", "inconclusive", "retake"]

function predictedLabel(result, status) {
  if (status === "retake") return "retake"
  return result
}

function emptyConfusion() {
  const row = () => Object.fromEntries(LABELS.map((k) => [k, 0]))
  return Object.fromEntries(LABELS.map((k) => [k, row()]))
}

function scoreRows(rows) {
  const confusion = emptyConfusion()
  for (const row of rows) confusion[row.actual][row.predicted] += 1
  const n = rows.length
  const recallOf = (label) => {
    const support = LABELS.reduce((s, p) => s + confusion[label][p], 0)
    if (!support) return null
    return confusion[label][label] / support
  }
  return {
    n,
    confusion,
    recall: { positive: recallOf("positive"), negative: recallOf("negative") },
    inconclusiveRate: n ? rows.filter((r) => r.predicted === "inconclusive").length / n : 0,
    retakeRate: n ? rows.filter((r) => r.predicted === "retake").length / n : 0,
  }
}

const here = dirname(fileURLToPath(import.meta.url))
const path = resolve(process.argv[2] ?? resolve(here, "../eval/manifest.example.json"))
const parsed = JSON.parse(readFileSync(path, "utf8"))
const rows = parsed.rows ?? parsed
const scored = rows.filter((r) => r.predictedResult && r.predictedStatus)
console.log(
  "Do not tune THRESHOLDS on the same captures used to report these rates. Split by session/device and hold out.",
)
console.log(`Manifest: ${path}`)
console.log(`Rows skipped (no prediction yet): ${rows.length - scored.length}`)
if (!scored.length) {
  console.log("No scored rows. Fill predictedResult and predictedStatus on a held-out session.")
  process.exit(0)
}

function printMetrics(title, list) {
  const m = scoreRows(
    list.map((r) => ({
      actual: r.simulatedLabel,
      predicted: predictedLabel(r.predictedResult, r.predictedStatus),
    })),
  )
  console.log(`\n${title} (n=${m.n})`)
  console.log(`recall+ ${m.recall.positive ?? "n/a"}  recall− ${m.recall.negative ?? "n/a"}`)
  console.log(`inconclusiveRate ${m.inconclusiveRate.toFixed(3)}  retakeRate ${m.retakeRate.toFixed(3)}`)
  console.log("confusion actual\\pred  " + LABELS.join(" "))
  for (const a of LABELS) {
    console.log(`  ${a}  ${LABELS.map((p) => m.confusion[a][p]).join(" ")}`)
  }
}

printMetrics("overall", scored)
for (const key of ["sessionId", "deviceId"]) {
  const groups = {}
  for (const row of scored) {
    ;(groups[row[key]] ??= []).push(row)
  }
  for (const [k, list] of Object.entries(groups)) printMetrics(`${key} ${k}`, list)
}
