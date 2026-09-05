import { useState, type ReactNode } from "react"
import type { ClassifyDebug, QualityFlag, ResultLabel } from "../color/types"
import { closenessPct, explainCall, FLAG_SHORT, rgbCss } from "../lib/explain"
import {
  benchmarkStatus,
  clearBenchmarks,
  savePrintRunRgb,
  setNegativeLab,
  setPositiveLab,
} from "../lib/printRun"
import { Banner } from "./Banner"

function ResultGlyph({ result }: { result: ResultLabel }) {
  if (result === "positive") {
    return (
      <svg className="hero-glyph" width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r="17" fill="#087a55" opacity="0.22" />
        <circle cx="19" cy="19" r="11" fill="#087a55" opacity="0.75" />
        <circle cx="19" cy="19" r="5" fill="#d9f0e4" />
      </svg>
    )
  }
  if (result === "negative") {
    return (
      <svg className="hero-glyph" width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
        <circle cx="19" cy="19" r="17" fill="#256b8d" opacity="0.18" />
        <circle cx="19" cy="19" r="13" fill="none" stroke="#256b8d" strokeWidth="2.5" opacity="0.75" />
        <path d="M13 19 l5 5 l8-9" stroke="#155a78" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round" fill="none" />
      </svg>
    )
  }
  return (
    <svg className="hero-glyph" width="38" height="38" viewBox="0 0 38 38" aria-hidden="true">
      <circle cx="19" cy="19" r="17" fill="#a85616" opacity="0.18" />
      <circle cx="19" cy="19" r="13" fill="none" stroke="#a85616" strokeWidth="2.5" opacity="0.7" />
      <text x="19" y="24" textAnchor="middle" fontSize="16" fontWeight="800" fill="#8b430f">?</text>
    </svg>
  )
}

export function ResultView(props: {
  result: ResultLabel
  imageDataUrl: string
  debug: ClassifyDebug | null
  onSeal: () => void
  onRetake: () => void
  extra?: ReactNode
}) {
  const [openTech, setOpenTech] = useState(false)
  const [benchNote, setBenchNote] = useState<string | null>(null)
  const explained = props.debug ? explainCall(props.result, props.debug) : null
  const d = props.debug?.deltaE
  const flags: QualityFlag[] = props.debug?.qualityFlags ?? []
  const bench = benchmarkStatus()

  const winner: ResultLabel | null = d
    ? d.positive <= d.negative && d.positive <= d.muddy
      ? "positive"
      : d.negative <= d.positive && d.negative <= d.muddy
        ? "negative"
        : "inconclusive"
    : null

  return (
    <>
      <p className="kicker">Presumptive call · immediately after capture</p>

      {flags.length > 0 && (
        <div className="quality-flags">
          {flags.map((f) => (
            <span key={f} className="quality-flag-chip" title={f}>
              {FLAG_SHORT[f]}
            </span>
          ))}
        </div>
      )}

      <div className={`hero ${props.result}`}>
        <div className="hero-header">
          <ResultGlyph result={props.result} />
          <div className="hero-titles">
            <div className="hero-kicker">Field classification</div>
            <div className="hero-word">{props.result}</div>
          </div>
        </div>
        {props.debug?.kitColour && (
          <div className="hero-colour">
            <span
              className="hero-swatch"
              style={{ background: rgbCss(props.debug.kitRgb) }}
              aria-hidden="true"
            />
            <div>
              <div className="hero-colour-kicker">Kit colour</div>
              <div className="hero-colour-name">{props.debug.kitColour.label}</div>
              <p className={`hero-colour-match ${props.debug.kitColour.vsExpected}`}>
                {props.debug.kitColour.vsExpected === "positive"
                  ? `Matches POSITIVE (${props.debug.kitColour.expectedPositive})`
                  : props.debug.kitColour.vsExpected === "negative"
                    ? `Matches NEGATIVE (${props.debug.kitColour.expectedNegative})`
                    : `Not ${props.debug.kitColour.expectedPositive} or ${props.debug.kitColour.expectedNegative}`}
              </p>
            </div>
          </div>
        )}
        <p className="hero-why">
          {explained?.headline ?? "No colour debug attached. Recapture to see why."}
        </p>
      </div>
      <Banner />

      {d && (
        <div className="card">
          <div className="section-head">
            <p className="section-title">Colour match</p>
            {props.debug && (
              <span className={`confidence-badge ${props.debug.confidence}`}>
                {props.debug.confidence} confidence · {props.debug.confidenceScore}/100
              </span>
            )}
          </div>
          <p className="muted" style={{ marginBottom: "0.75rem" }}>
            Taller/longer bar = closer colour match. ΔE is the technical distance value — lower is
            closer.
          </p>
          <Meter
            label={`Positive · ${props.debug?.kitColour?.expectedPositive ?? "magenta"}`}
            value={d.positive}
            tone="positive"
            isWinner={winner === "positive"}
          />
          <Meter
            label={`Negative · ${props.debug?.kitColour?.expectedNegative ?? "white"}`}
            value={d.negative}
            tone="negative"
            isWinner={winner === "negative"}
          />
          <Meter label="Muddy · mixed" value={d.muddy} tone="inconclusive" isWinner={winner === "inconclusive"} />
        </div>
      )}

      {explained && (
        <div className="card">
          <p className="section-title">Why this happened</p>
          <ol className="why-list">
            {explained.bullets.map((b, i) => (
              <li key={i}>{b}</li>
            ))}
          </ol>
        </div>
      )}

      <img className="shot" src={props.imageDataUrl} alt="Captured field test" />

      {props.debug && (
        <div className="demo-card">
          <div className="demo-card-title">Set benchmark (your sheets / lighting)</div>
          <p className="muted">
            Defaults are the daylight craft-sheet card plus magenta (positive) and white (negative).
            Override here if the lamp changes. Card saved: {bench.card ? "yes" : "not yet"}.
            Kit colours saved: {bench.classes ? "yes" : "not yet"}.
          </p>
          <button
            className="ghost"
            onClick={() => {
              savePrintRunRgb(props.debug!.patchRgb)
              setBenchNote("Saved the six card squares. Retake a test after this.")
            }}
          >
            1 · Save these 6 squares as my printed card
          </button>
          <button
            className="ghost"
            onClick={() => {
              setPositiveLab(props.debug!.kitLab)
              setBenchNote("Saved this kit colour as POSITIVE. Next magenta (or this colour) should call positive.")
            }}
          >
            2 · This kit is my POSITIVE
          </button>
          <button
            className="ghost"
            onClick={() => {
              setNegativeLab(props.debug!.kitLab)
              setBenchNote("Saved this kit colour as NEGATIVE (white / unused).")
            }}
          >
            3 · This kit is my NEGATIVE (white)
          </button>
          <button
            className="ghost"
            onClick={() => {
              clearBenchmarks()
              setBenchNote("Cleared. Back to daylight magenta / white defaults.")
            }}
          >
            Reset to daylight defaults
          </button>
          {benchNote ? <p className="muted">{benchNote}</p> : null}
        </div>
      )}

      <button className="ghost" onClick={() => setOpenTech((v) => !v)}>
        {openTech ? "Hide" : "Show"} technical numbers
      </button>
      {openTech && props.debug ? (
        <pre className="debug">{JSON.stringify(props.debug, null, 2)}</pre>
      ) : null}

      {props.extra}
      <button className="primary" onClick={props.onSeal}>
        Seal this photo
      </button>
      <button className="ghost" onClick={props.onRetake}>
        Retake
      </button>
    </>
  )
}

function Meter(props: { label: string; value: number; tone: ResultLabel; isWinner: boolean }) {
  return (
    <div className={`meter${props.isWinner ? " winner" : ""}`}>
      <div className="meter-row">
        <span>{props.label}</span>
        <span style={{ display: "flex", alignItems: "center", gap: "0.35rem" }}>
          {props.isWinner && <span className="meter-winner-badge">closest</span>}
          <span className="meter-de">ΔE {props.value.toFixed(1)}</span>
        </span>
      </div>
      <div className="track">
        <div className={`fill ${props.tone}`} style={{ width: `${closenessPct(props.value)}%` }} />
      </div>
    </div>
  )
}
