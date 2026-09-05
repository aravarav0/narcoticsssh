import { useState } from "react"
import { Banner } from "./Banner"
import { addCalibrationSample, calibrationCounts } from "../lib/calibrationSet"
import { saveCardBaseline } from "../lib/printRun"
import { downloadDataUrl, downloadJson } from "../lib/download"
import type { CalibrationShotId } from "../lib/shots"
import type { TestRecord } from "../lib/store"
import type { ClassName } from "../color/types"

export function ResultView(props: {
  record: TestRecord
  debugJson: string
  shotId: CalibrationShotId | ""
  onSaveShotAdvance: () => void
  onOpenRecord: () => void
  onNewCapture: () => void
}) {
  const { record } = props
  const [detailsOpen, setDetailsOpen] = useState(false)
  const [calMsg, setCalMsg] = useState<string | null>(null)
  const counts = calibrationCounts()
  const headline = record.status === "retake" ? "retake" : record.result
  const headlineClass = record.status === "retake" ? "retake" : record.result

  function saveSample(label: ClassName) {
    if (!record.kitLab) {
      setCalMsg("No calibrated kit Lab on this record.")
      return
    }
    const out = addCalibrationSample({
      label,
      lab: record.kitLab,
      capturedAt: record.capturedAt,
      qualityStatus: record.qualityStatus,
    })
    const next = calibrationCounts()
    setCalMsg(
      out.ok
        ? `Saved simulated ${label} sample. Positive ${next.positive}/${next.min}, negative ${next.negative}/${next.min}.`
        : out.error,
    )
  }

  function saveBaseline() {
    try {
      const debug = JSON.parse(props.debugJson) as { patchRgb?: Record<string, { r: number; g: number; b: number }> }
      const rgb = debug.patchRgb
      if (!rgb?.white || !rgb.black || !rgb.gray || !rgb.red || !rgb.yellow || !rgb.purple) {
        setCalMsg("No patch RGB on this capture.")
        return
      }
      saveCardBaseline({
        white: rgb.white,
        black: rgb.black,
        gray: rgb.gray,
        red: rgb.red,
        yellow: rgb.yellow,
        purple: rgb.purple,
      })
      setCalMsg(
        "Stored as a controlled card baseline for this print. These are camera JPEG values, not a laboratory colour measurement.",
      )
    } catch {
      setCalMsg("Could not read patch RGB from technical details.")
    }
  }

  return (
    <>
      <p className="kicker">Result</p>
      <h1>
        <span className={`chip ${headlineClass}`}>{headline}</span>
      </h1>
      <p className="muted">
        Measurement status: <strong>{record.status}</strong>
        {record.qualityStatus === "retake" ? " · optical quality failed" : " · capture quality usable"}
      </p>
      <Banner />
      <img src={record.imageDataUrl} alt="Captured test" style={{ width: "100%", border: "1px solid var(--line)" }} />
      {record.reasons.length ? (
        <div className="card">
          <p className="muted">Why this call</p>
          <ul className="reasons">
            {record.reasons.map((r) => (
              <li key={r}>{r}</li>
            ))}
          </ul>
        </div>
      ) : (
        <p className="muted">Optics and class margin passed. Presumptive only — laboratory confirmation required.</p>
      )}
      <div className="card">
        <p className="muted">Simulated calibration set (local only)</p>
        <p>
          Positive {counts.positive}/{counts.min} · Negative {counts.negative}/{counts.min} · Muddy {counts.muddy}{" "}
          (optional)
        </p>
        <p className="muted">
          One capture is never a class model. Only optically valid frames can be saved. Need at least {counts.min}{" "}
          valid samples each of positive and negative.
        </p>
        <div className="row">
          <button className="ghost" disabled={record.qualityStatus !== "valid"} onClick={() => saveSample("positive")}>
            Save + sample
          </button>
          <button className="ghost" disabled={record.qualityStatus !== "valid"} onClick={() => saveSample("negative")}>
            Save − sample
          </button>
        </div>
        <button className="ghost" disabled={record.qualityStatus !== "valid"} onClick={() => saveSample("muddy")}>
          Save muddy sample (optional)
        </button>
        <button className="ghost" onClick={saveBaseline}>
          Save card JPEG as controlled baseline
        </button>
        {calMsg ? <p className="muted">{calMsg}</p> : null}
      </div>
      <button className="ghost" onClick={() => setDetailsOpen((v) => !v)}>
        {detailsOpen ? "Hide technical details" : "Show technical details"}
      </button>
      {detailsOpen ? (
        <pre className="debug">
          {`Correction: ${record.method}
Flags: ${record.flags.length ? record.flags.join(", ") : "none"}
ΔE values are Lab distances, not probability or confidence.

`}
          {props.debugJson}
        </pre>
      ) : null}
      {props.shotId ? (
        <button
          className="primary"
          onClick={() => {
            const name = props.shotId
            downloadDataUrl(`${name}.jpg`, record.imageDataUrl)
            downloadJson(`${name}.json`, {
              shotId: name,
              result: record.result,
              status: record.status,
              qualityStatus: record.qualityStatus,
              method: record.method,
              flags: record.flags,
              reasons: record.reasons,
              debug: JSON.parse(props.debugJson || "{}"),
            })
            props.onSaveShotAdvance()
          }}
        >
          Save this shot · next
        </button>
      ) : null}
      <button className="ghost" onClick={props.onOpenRecord}>
        Open sealed record
      </button>
      <button className="ghost" onClick={props.onNewCapture}>
        New capture
      </button>
    </>
  )
}
