import type { MeasurementStatus, ResultLabel } from "./types"

export type EvalLabel = "positive" | "negative" | "inconclusive" | "retake"

export type ManifestRow = {
  imagePath: string
  simulatedLabel: EvalLabel
  deviceId: string
  sessionId: string
  condition: string
  predictedResult?: ResultLabel | null
  predictedStatus?: MeasurementStatus | null
}

export type Confusion = Record<EvalLabel, Record<EvalLabel, number>>

export type SplitMetrics = {
  n: number
  confusion: Confusion
  recall: { positive: number | null; negative: number | null }
  inconclusiveRate: number
  retakeRate: number
}

export const EVAL_SPLIT_NOTE =
  "Do not tune THRESHOLDS on the same captures used to report these rates. Split by session/device and hold out."

const LABELS: EvalLabel[] = ["positive", "negative", "inconclusive", "retake"]

export function emptyConfusion(): Confusion {
  const row = () => Object.fromEntries(LABELS.map((k) => [k, 0])) as Record<EvalLabel, number>
  return Object.fromEntries(LABELS.map((k) => [k, row()])) as Confusion
}

export function predictedLabel(result: ResultLabel, status: MeasurementStatus): EvalLabel {
  if (status === "retake") return "retake"
  return result
}

export function scoreRows(
  rows: Array<{ actual: EvalLabel; predicted: EvalLabel }>,
): SplitMetrics {
  const confusion = emptyConfusion()
  for (const row of rows) {
    confusion[row.actual][row.predicted] += 1
  }
  const n = rows.length
  const recallOf = (label: "positive" | "negative"): number | null => {
    const support = LABELS.reduce((s, p) => s + confusion[label][p], 0)
    if (support === 0) return null
    return confusion[label][label] / support
  }
  const retake = rows.filter((r) => r.predicted === "retake").length
  const inconclusive = rows.filter((r) => r.predicted === "inconclusive").length
  return {
    n,
    confusion,
    recall: { positive: recallOf("positive"), negative: recallOf("negative") },
    inconclusiveRate: n ? inconclusive / n : 0,
    retakeRate: n ? retake / n : 0,
  }
}

export function scoredFromManifest(rows: ManifestRow[]): ManifestRow[] {
  return rows.filter((r) => r.predictedResult && r.predictedStatus)
}

export function groupBy(rows: ManifestRow[], key: "sessionId" | "deviceId"): Record<string, SplitMetrics> {
  const groups: Record<string, ManifestRow[]> = {}
  for (const row of scoredFromManifest(rows)) {
    const k = row[key]
    ;(groups[k] ??= []).push(row)
  }
  const out: Record<string, SplitMetrics> = {}
  for (const [k, list] of Object.entries(groups)) {
    out[k] = scoreRows(
      list.map((r) => ({
        actual: r.simulatedLabel,
        predicted: predictedLabel(r.predictedResult!, r.predictedStatus!),
      })),
    )
  }
  return out
}

export function evaluateManifest(rows: ManifestRow[]): {
  overall: SplitMetrics | null
  bySession: Record<string, SplitMetrics>
  byDevice: Record<string, SplitMetrics>
  skipped: number
  note: string
} {
  const scored = scoredFromManifest(rows)
  const overall =
    scored.length === 0
      ? null
      : scoreRows(
          scored.map((r) => ({
            actual: r.simulatedLabel,
            predicted: predictedLabel(r.predictedResult!, r.predictedStatus!),
          })),
        )
  return {
    overall,
    bySession: groupBy(rows, "sessionId"),
    byDevice: groupBy(rows, "deviceId"),
    skipped: rows.length - scored.length,
    note: EVAL_SPLIT_NOTE,
  }
}

export function formatReport(report: ReturnType<typeof evaluateManifest>): string {
  const lines = [report.note, `Rows skipped (no prediction yet): ${report.skipped}`]
  if (!report.overall) {
    lines.push("No scored rows. Fill predictedResult and predictedStatus on a held-out session.")
    return lines.join("\n")
  }
  const fmt = (m: SplitMetrics, title: string) => {
    lines.push(`\n${title} (n=${m.n})`)
    lines.push(`recall+ ${m.recall.positive ?? "n/a"}  recall− ${m.recall.negative ?? "n/a"}`)
    lines.push(`inconclusiveRate ${m.inconclusiveRate.toFixed(3)}  retakeRate ${m.retakeRate.toFixed(3)}`)
    lines.push("confusion actual\\pred  " + LABELS.join(" "))
    for (const a of LABELS) {
      lines.push(`  ${a}  ${LABELS.map((p) => m.confusion[a][p]).join(" ")}`)
    }
  }
  fmt(report.overall, "overall")
  for (const [k, m] of Object.entries(report.bySession)) fmt(m, `session ${k}`)
  for (const [k, m] of Object.entries(report.byDevice)) fmt(m, `device ${k}`)
  return lines.join("\n")
}
