import { useMemo, useState } from "react"
import { Banner } from "./ui/Banner"
import { CaptureScreen } from "./ui/CaptureScreen"
import { downloadDataUrl, downloadJson } from "./lib/download"
import { flipFirstByte, sha256Hex } from "./lib/hash"
import { CALIBRATION_SHOTS, type CalibrationShotId } from "./lib/shots"
import { loadRecords, saveRecord, type TestRecord } from "./lib/store"
import { loadImage } from "./lib/camera"
import { evidencePayload, verifyRecordSeal } from "./lib/seal"

type Page = "login" | "capture" | "result" | "record" | "log"

export default function App() {
  const [page, setPage] = useState<Page>("login")
  const [officerId, setOfficerId] = useState(() => sessionStorage.getItem("sih26231.officer") ?? "")
  const [draftId, setDraftId] = useState(officerId)
  const [current, setCurrent] = useState<TestRecord | null>(null)
  const [debug, setDebug] = useState("")
  const [query, setQuery] = useState("")
  const [flippedHash, setFlippedHash] = useState<string | null>(null)
  const [sealVerified, setSealVerified] = useState<boolean | null>(null)
  const [shotId, setShotId] = useState<CalibrationShotId | "">("01-card-only-daylight")
  const records = useMemo(() => loadRecords(), [page, current])

  function enter() {
    const id = draftId.trim()
    if (!id) return
    sessionStorage.setItem("sih26231.officer", id)
    setOfficerId(id)
    setPage("capture")
  }

  function afterCapture(record: TestRecord, classifiedJson: string) {
    saveRecord(record)
    setCurrent(record)
    setDebug(classifiedJson)
    setFlippedHash(null)
    setSealVerified(null)
    setPage("result")
  }

  async function proveHashMoves() {
    if (!current) return
    const img = await loadImage(current.imageDataUrl)
    const canvas = document.createElement("canvas")
    canvas.width = img.naturalWidth
    canvas.height = img.naturalHeight
    const ctx = canvas.getContext("2d")
    if (!ctx) return
    ctx.drawImage(img, 0, 0)
    const blob: Blob = await new Promise((resolve, reject) =>
      canvas.toBlob((b) => (b ? resolve(b) : reject(new Error("blob"))), "image/jpeg", 0.92),
    )
    const flipped = flipFirstByte(await blob.arrayBuffer())
    setFlippedHash(await sha256Hex(flipped))
  }

  return (
    <div className="app">
      {page === "login" && (
        <>
          <p className="kicker">NCB · SIH26231 · software prototype</p>
          <h1>Digital Companion for Field Drug Testing</h1>
          <Banner />
          <p className="muted">
            Photograph the kit with the colour card in the same frame. Classify presumptive
            positive / negative / inconclusive. Seal the photo with time, GPS, officer ID, SHA-256.
          </p>
          <div className="card">
            <label htmlFor="oid">Operator identifier</label>
            <input
              id="oid"
              value={draftId}
              onChange={(e) => setDraftId(e.target.value)}
              placeholder="e.g. NCB-DEMO-01"
              autoComplete="off"
            />
          </div>
          <button className="primary" onClick={enter}>
            Continue
          </button>
          <button className="ghost" onClick={() => setPage("log")}>
            Search log
          </button>
        </>
      )}

      {page === "capture" && (
        <CaptureScreen
          officerId={officerId}
          shotId={shotId}
          onShotId={setShotId}
          onCaptured={afterCapture}
          onLog={() => setPage("log")}
        />
      )}

      {page === "result" && current && (
        <>
          <p className="kicker">Result</p>
          <h1>
            <span className={`chip ${current.result}`}>{current.result}</span>
          </h1>
          <Banner />
          <img src={current.imageDataUrl} alt="Captured test" style={{ width: "100%", border: "1px solid var(--line)" }} />
          <p className="debug">
            Calibration: {current.method}
            {current.flags.length ? ` · flags: ${current.flags.join(", ")}` : " · quality ok"}
          </p>
          <p className="debug">Confidence: {JSON.parse(debug || "{}").confidence ?? "—"} ({JSON.parse(debug || "{}").confidenceScore ?? "—"}/100)</p>
          <pre className="debug">{debug}</pre>
          {shotId ? (
            <button
              className="primary"
              onClick={() => {
                const name = shotId
                downloadDataUrl(`${name}.jpg`, current.imageDataUrl)
                downloadJson(`${name}.json`, {
                  shotId: name,
                  result: current.result,
                  method: current.method,
                  flags: current.flags,
                  debug: JSON.parse(debug || "{}"),
                })
                const i = CALIBRATION_SHOTS.findIndex((s) => s.id === name)
                const next = CALIBRATION_SHOTS[i + 1]
                if (next) setShotId(next.id)
                setPage("capture")
              }}
            >
              Save this shot · next
            </button>
          ) : null}
          <button className="ghost" onClick={() => setPage("record")}>
            Open sealed record
          </button>
          <button className="ghost" onClick={() => setPage("capture")}>
            New capture
          </button>
        </>
      )}

      {page === "record" && current && (
        <>
          <p className="kicker">Tamper-evident record</p>
          <h1>Presumptive sealed record</h1>
          <Banner />
          <div className="card">
            <p>Officer: {current.officerId}</p>
            <p>Time (UTC): {current.capturedAt}</p>
            <p>
              GPS:{" "}
              {current.lat != null && current.lon != null
                ? `${current.lat.toFixed(5)}, ${current.lon.toFixed(5)} ±${current.gpsAccuracyM ?? "?"}m`
                : "not available"}
            </p>
            <p>Call: {current.result}</p>
            <p className="muted">SHA-256 of JPEG bytes</p>
            <p className="mono">{current.sha256Hex}</p>
            <p className="muted">Evidence signature: {current.seal ? `P-256 · key ${current.seal.keyId}` : "legacy / unsigned"}</p>
            {sealVerified != null ? <p className={sealVerified ? "seal-ok" : "seal-bad"}>{sealVerified ? "✓ Signature and sealed metadata verified" : "✕ Verification failed — record may have changed"}</p> : null}
            {flippedHash ? (
              <p className="mono hash-flip">After flipping 1 byte: {flippedHash}</p>
            ) : null}
          </div>
          <button className="ghost" onClick={() => void proveHashMoves()}>
            Flip one byte — hash must change
          </button>
          <button className="ghost" onClick={() => void verifyRecordSeal(current, current.seal).then(setSealVerified)}>
            Verify digital signature
          </button>
          <button className="ghost" onClick={() => downloadJson(`SIH26231-evidence-${current.id}.json`, evidencePayload(current, current.seal))}>
            Export verifiable evidence package
          </button>
          <button className="primary" onClick={() => setPage("log")}>
            Searchable log
          </button>
        </>
      )}

      {page === "log" && (
        <LogScreen
          query={query}
          onQuery={setQuery}
          records={records}
          onOpen={(r) => {
            setCurrent(r)
            setDebug("")
            setSealVerified(null)
            setPage("record")
          }}
          onNew={() => (officerId ? setPage("capture") : setPage("login"))}
        />
      )}
    </div>
  )
}

function LogScreen(props: {
  query: string
  onQuery: (q: string) => void
  records: TestRecord[]
  onOpen: (r: TestRecord) => void
  onNew: () => void
}) {
  const q = props.query.trim().toLowerCase()
  const rows = props.records.filter((r) => {
    if (!q) return true
    return (
      r.officerId.toLowerCase().includes(q) ||
      r.result.includes(q) ||
      r.sha256Hex.includes(q)
    )
  })
  return (
    <>
      <p className="kicker">Log</p>
      <h1>Search tests</h1>
      <input
        value={props.query}
        onChange={(e) => props.onQuery(e.target.value)}
        placeholder="officer ID, result, or hash"
      />
      <div className="list">
        {rows.length === 0 ? <p className="muted">No records yet.</p> : null}
        {rows.map((r) => (
          <button key={r.id} className="item" onClick={() => props.onOpen(r)}>
            <strong className={`chip ${r.result}`}>{r.result}</strong>
            <div className="muted">
              {r.officerId} · {r.capturedAt.replace("T", " ").slice(0, 19)}
            </div>
            <div className="mono">{r.sha256Hex.slice(0, 20)}…</div>
          </button>
        ))}
      </div>
      <button className="primary" onClick={props.onNew}>
        New capture
      </button>
    </>
  )
}
