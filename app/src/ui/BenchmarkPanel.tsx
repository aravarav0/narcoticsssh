import { useState } from "react"
import { benchmarkStatus, clearBenchmarks, savePrintRunRgb, setNegativeLab, setPositiveLab } from "../lib/printRun"
import type { TestRecord } from "../lib/store"

/** Optional override of the baked IMG_3570 card. Hidden on the home screen. */
export function BenchmarkPanel({ last }: { last: TestRecord | null }) {
  const [note, setNote] = useState<string | null>(null)
  const bench = benchmarkStatus()
  const debug = last?.debug ?? null

  return (
    <>
      <p className="muted">
        The app already uses the printed card from the positive benchmark photo. Leave this closed
        unless a new lamp or a new print run needs its own squares. Last test:{" "}
        {last ? last.result : "none yet"}. Card override: {bench.card ? "yes" : "no"}. Kit colours:{" "}
        {bench.classes ? "yes" : "no"}.
      </p>
      {debug ? (
        <>
          <button
            className="ghost"
            onClick={() => {
              savePrintRunRgb(debug.patchRgb)
              setNote("Saved the six card squares from the last photo. Recapture to use them.")
            }}
          >
            Save last photo’s 6 squares as my card
          </button>
          <button
            className="ghost"
            onClick={() => {
              setPositiveLab(debug.kitLab)
              setNote("Last kit colour is now POSITIVE.")
            }}
          >
            Last kit is my POSITIVE
          </button>
          <button
            className="ghost"
            onClick={() => {
              setNegativeLab(debug.kitLab)
              setNote("Last kit colour is now NEGATIVE (white / unused).")
            }}
          >
            Last kit is my NEGATIVE
          </button>
        </>
      ) : (
        <p className="muted">Capture one test first if you want to save a custom card from a photo.</p>
      )}
      <button
        className="ghost"
        onClick={() => {
          clearBenchmarks()
          setNote("Cleared. Back to the baked purple / white defaults.")
        }}
      >
        Reset to baked defaults
      </button>
      {note ? <p className="muted">{note}</p> : null}
    </>
  )
}
