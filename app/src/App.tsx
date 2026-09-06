import { useMemo, useState } from "react"
import { Banner } from "./ui/Banner"
import { BenchmarkPanel } from "./ui/BenchmarkPanel"
import { CaptureScreen } from "./ui/CaptureScreen"
import { ResultView } from "./ui/ResultView"
import { Steps } from "./ui/Steps"
import { downloadDataUrl, downloadJson } from "./lib/download"
import { flipFirstByte, sha256Hex } from "./lib/hash"
import { CALIBRATION_SHOTS, type CalibrationShotId } from "./lib/shots"
import { loadRecords, patchRecord, saveRecord, type TestRecord } from "./lib/store"
import { loadImage } from "./lib/camera"
import type { GpsFix } from "./lib/gps"
import { evidencePayload, verifyRecordSeal, type EvidenceSeal } from "./lib/seal"

type Page = "login" | "capture" | "result" | "record" | "log"

export default function App() {
  const [page, setPage] = useState<Page>("login")
  const [officerId, setOfficerId] = useState(() => sessionStorage.getItem("sih26231.officer") ?? "")
  const [draftId, setDraftId] = useState(officerId)
  const [current, setCurrent] = useState<TestRecord | null>(null)
  const [query, setQuery] = useState("")
  const [flippedHash, setFlippedHash] = useState<string | null>(null)
  const [shotId, setShotId] = useState<CalibrationShotId | "">("")
  const [copied, setCopied] = useState(false)
  const [sealVerified, setSealVerified] = useState<boolean | null>(null)
  const records = useMemo(() => loadRecords(), [page, current])

  function enter() {
    const id = draftId.trim()
    if (!id) return
    sessionStorage.setItem("sih26231.officer", id)
    setOfficerId(id)
    setPage("capture")
  }

  function afterCapture(record: TestRecord) {
    saveRecord(record)
    setCurrent(record)
    setFlippedHash(null)
    setSealVerified(null)
    setPage("result")
  }

  function onGps(id: string, gps: GpsFix | null) {
    if (!gps) return
    const updated = patchRecord(id, {
      lat: gps.lat,
      lon: gps.lon,
      gpsAccuracyM: gps.accuracyM,
    })
    if (updated) setCurrent((c) => (c && c.id === id ? updated : c))
  }

  function onSeal(id: string, seal: EvidenceSeal) {
    const updated = patchRecord(id, { seal })
    if (updated) setCurrent((c) => (c && c.id === id ? updated : c))
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

  async function copyHash() {
    if (!current) return
    try {
      await navigator.clipboard.writeText(current.sha256Hex)
      setCopied(true)
      setTimeout(() => setCopied(false), 1500)
    } catch {
      setCopied(false)
    }
  }

  return (
    <div className="app">
      <header className="app-header">
        <span className="app-header-name">
          <span className="brand-mark" aria-hidden="true">◆</span>
          Field Companion
        </span>
        <span className="app-header-tag">NCB · SIH26231</span>
      </header>
      <Steps
        page={page}
        hasRecord={current != null}
        onGo={(p) => {
          if (p === "result" && !current) return
          if (p === "record" && !current) return
          setPage(p)
        }}
      />

      {page === "login" && (
        <>
          <p className="kicker">NCB · SIH26231 · field prototype</p>
          <h1>Digital Companion for Field Drug Testing</h1>
          <Banner />
          <p className="muted">
            One pocket colour card lives in the kit — like a luggage tag, not six papers on the
            ground. Photograph kit + card together. The app names the colour, then locks the photo.
          </p>
          <div className="feature-grid">
            <div>
              <strong>1</strong>
              Pocket card in the same photo
            </div>
            <div>
              <strong>2</strong>
              Pos / neg / inconclusive
            </div>
            <div>
              <strong>3</strong>
              Time · GPS · hash
            </div>
            <div>
              <strong>4</strong>
              Searchable log
            </div>
          </div>
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
            Start capture
          </button>
          <button className="ghost" onClick={() => setPage("log")}>
            Open existing log
          </button>
          <details className="more">
            <summary>Custom colour benchmarks (optional)</summary>
            <BenchmarkPanel last={records[0] ?? null} />
          </details>
        </>
      )}

      {page === "capture" && (
        <CaptureScreen
          officerId={officerId}
          shotId={shotId}
          onShotId={setShotId}
          onCaptured={afterCapture}
          onGps={onGps}
          onSeal={onSeal}
          onLog={() => setPage("log")}
        />
      )}

      {page === "result" && current && (
        <ResultView
          result={current.result}
          imageDataUrl={current.imageDataUrl}
          debug={current.debug}
          detectedLayout={current.detectedLayout}
          kitAutoFound={current.kitAutoFound}
          relitImageDataUrl={current.relitImageDataUrl}
          onSeal={() => setPage("record")}
          onRetake={() => setPage("capture")}
          extra={
            shotId ? (
              <button
                className="ghost"
                onClick={() => {
                  const name = shotId
                  downloadDataUrl(`${name}.jpg`, current.imageDataUrl)
                  downloadJson(`${name}.json`, {
                    shotId: name,
                    result: current.result,
                    debug: current.debug,
                  })
                  const i = CALIBRATION_SHOTS.findIndex((s) => s.id === name)
                  const next = CALIBRATION_SHOTS[i + 1]
                  if (next) setShotId(next.id)
                  setPage("capture")
                }}
              >
                Save calibration shot · next
              </button>
            ) : null
          }
        />
      )}

      {page === "record" && current && (
        <>
          <p className="kicker">Tamper-evident record</p>
          <h1>Photo sealed</h1>
          <Banner />
          <div className={`chip ${current.result}`}>{current.result}</div>
          {current.debug?.kitColour ? (
            <p className="muted" style={{ marginTop: "0.35rem" }}>
              Kit colour <strong>{current.debug.kitColour.label}</strong>
              {current.debug.kitColour.hex ? ` · ${current.debug.kitColour.hex}` : ""}
              {" · "}
              {current.debug.kitColour.vsExpected === "neither"
                ? `not ${current.debug.kitColour.expectedPositive} or ${current.debug.kitColour.expectedNegative}`
                : `matches ${current.debug.kitColour.vsExpected}`}
            </p>
          ) : null}
          <div className="card facts">
            <div>
              <span>Officer</span>
              <strong>{current.officerId}</strong>
            </div>
            <div>
              <span>Time (UTC)</span>
              <strong>{current.capturedAt.replace("T", " ").slice(0, 19)}</strong>
            </div>
            <div>
              <span>Observed colour</span>
              <strong>
                {current.debug?.kitColour?.label ?? "—"}
                {current.debug?.kitColour?.hex ? ` · ${current.debug.kitColour.hex}` : ""}
              </strong>
            </div>
            <div>
              <span>GPS</span>
              {current.lat != null && current.lon != null ? (
                <strong>
                  {current.lat.toFixed(5)}, {current.lon.toFixed(5)} ±{current.gpsAccuracyM ?? "?"}m
                </strong>
              ) : (
                <strong className="gps-pending">locating… (or denied)</strong>
              )}
            </div>
            <div>
              <span>SHA-256 of JPEG</span>
              <div className="hash-row">
                <p className="mono">{current.sha256Hex}</p>
                <button
                  type="button"
                  className={`copy-btn${copied ? " copied" : ""}`}
                  onClick={() => void copyHash()}
                >
                  {copied ? "Copied" : "Copy"}
                </button>
              </div>
            </div>
            <div>
              <span>Digital signature</span>
              <strong>
                {current.seal ? `ECDSA P-256 · key ${current.seal.keyId}` : "sealing…"}
              </strong>
              {sealVerified != null ? (
                <p className={sealVerified ? "seal-ok" : "seal-bad"}>
                  {sealVerified
                    ? "✓ Signature and sealed metadata verified"
                    : "✕ Verification failed — record may have changed"}
                </p>
              ) : null}
            </div>
            {flippedHash ? (
              <div>
                <span>After flipping 1 byte</span>
                <p className="mono hash-flip">{flippedHash}</p>
              </div>
            ) : null}
          </div>
          <p className="muted">
            The SHA-256 seals the photo bytes; the ECDSA signature seals the whole record
            (officer, time, GPS, result) and chains to the previous record. Edit anything and
            verification fails. Presumptive record — not a court signature.
          </p>
          <button className="ghost" onClick={() => void proveHashMoves()}>
            Flip one byte — hash must change
          </button>
          <button
            className="ghost"
            disabled={!current.seal}
            onClick={() => void verifyRecordSeal(current, current.seal).then(setSealVerified)}
          >
            Verify digital signature
          </button>
          <button
            className="ghost"
            disabled={!current.seal}
            onClick={() =>
              downloadJson(`SIH26231-evidence-${current.id}.json`, evidencePayload(current, current.seal))
            }
          >
            Export verifiable evidence package
          </button>
          <button className="primary" onClick={() => setPage("log")}>
            Save to searchable log
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
            setSealVerified(null)
            setPage("result")
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
      r.sha256Hex.includes(q) ||
      (r.debug?.kitColour?.label.toLowerCase().includes(q) ?? false) ||
      (r.debug?.kitColour?.hex?.toLowerCase().includes(q) ?? false)
    )
  })
  return (
    <>
      <p className="kicker">Log</p>
      <div className="log-header-row">
        <h1>Search tests</h1>
        <span className="log-count">
          {props.records.length} {props.records.length === 1 ? "record" : "records"}
        </span>
      </div>
      <label className="log-search-label" htmlFor="log-search">
        Search by officer ID, result, colour, or hash
      </label>
      <input
        id="log-search"
        value={props.query}
        onChange={(e) => props.onQuery(e.target.value)}
        placeholder="officer ID, result, colour, or hash"
      />
      <div className="list">
        {rows.length === 0 ? <p className="muted">No records yet.</p> : null}
        {rows.map((r) => (
          <button key={r.id} className="item" onClick={() => props.onOpen(r)}>
            <strong className={`chip ${r.result}`}>{r.result}</strong>
            {r.debug?.kitColour ? (
              <div className="muted">
                {r.debug.kitColour.label}
                {r.debug.kitColour.hex ? ` · ${r.debug.kitColour.hex}` : ""}
              </div>
            ) : null}
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
