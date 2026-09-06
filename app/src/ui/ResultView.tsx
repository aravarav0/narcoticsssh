import { useEffect, useState, type ReactNode } from "react"
import { CARD_SRGB } from "../color/card"
import { DEFAULT_LAYOUT } from "../color/constants"
import { relightCanvas, relightVonKries } from "../color/relight"
import type { ClassifyDebug, Layout, QualityFlag, ResultLabel } from "../color/types"
import { loadImage } from "../lib/camera"
import { closenessPct, explainCall, FLAG_SHORT, rgbCss } from "../lib/explain"
import { CaptureOverlay, LayoutOverlay } from "./CaptureOverlay"
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
  detectedLayout?: Layout | null
  kitAutoFound?: boolean
  relitImageDataUrl?: string | null
  onSeal: () => void
  onRetake: () => void
  extra?: ReactNode
}) {
  const [openTech, setOpenTech] = useState(false)
  const [showRelit, setShowRelit] = useState(false)
  const [relitUrl, setRelitUrl] = useState<string | null>(props.relitImageDataUrl ?? null)
  const [relitBusy, setRelitBusy] = useState(!props.relitImageDataUrl)
  const overlayLayout = props.detectedLayout ?? DEFAULT_LAYOUT
  const autoDetected = props.detectedLayout != null
  const explained = props.debug ? explainCall(props.result, props.debug) : null
  const d = props.debug?.deltaE
  const flags: QualityFlag[] = props.debug?.qualityFlags ?? []

  useEffect(() => {
    if (props.relitImageDataUrl) {
      setRelitUrl(props.relitImageDataUrl)
      setRelitBusy(false)
      return
    }
    const debug = props.debug
    const src = props.imageDataUrl
    if (!debug || !src) {
      setRelitUrl(null)
      setRelitBusy(false)
      return
    }
    let cancelled = false
    setRelitBusy(true)
    void (async () => {
      try {
        const img = await loadImage(src)
        const canvas = document.createElement("canvas")
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight
        const ctx = canvas.getContext("2d", { willReadFrequently: true })
        if (!ctx) {
          if (!cancelled) {
            setRelitUrl(null)
            setRelitBusy(false)
          }
          return
        }
        ctx.drawImage(img, 0, 0)
        const url = debug.ccmMatrix
          ? relightCanvas(canvas, debug.ccmMatrix)
          : debug.patchRgb?.gray
            ? relightVonKries(canvas, debug.patchRgb.gray, CARD_SRGB.gray)
            : null
        if (!cancelled) setRelitUrl(url)
      } catch {
        if (!cancelled) setRelitUrl(null)
      } finally {
        if (!cancelled) setRelitBusy(false)
      }
    })()
    return () => {
      cancelled = true
    }
  }, [props.relitImageDataUrl, props.imageDataUrl, props.debug])

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
              style={{ background: props.debug.kitColour.hex || rgbCss(props.debug.kitRgb) }}
              aria-hidden="true"
            />
            <div>
              <div className="hero-colour-kicker">Kit colour</div>
              <div className="hero-colour-name">{props.debug.kitColour.label}</div>
              {props.debug.kitColour.hex ? (
                <p className="hero-hex">
                  <span>{props.debug.kitColour.hex}</span>
                  <span className="hero-hue">hue {Math.round(props.debug.kitColour.hue)}°</span>
                </p>
              ) : null}
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
            label={`Positive · ${props.debug?.kitColour?.expectedPositive ?? "purple"}`}
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

      <div className="card">
        <div className="section-head">
          <p className="section-title">
            {showRelit ? "Corrected · lighting removed" : "Your photo"}
          </p>
          {relitUrl ? (
            <button className="primary relit-toggle" onClick={() => setShowRelit((v) => !v)}>
              {showRelit ? "Show original" : "Show corrected"}
            </button>
          ) : relitBusy ? (
            <span className="muted">Building corrected preview…</span>
          ) : null}
        </div>
        <p className="muted" style={{ marginBottom: "0.6rem" }}>
          {relitUrl
            ? showRelit
              ? "This is the un-lit frame: the six card squares set a colour-correction matrix, then the whole photo is dragged into that lighting. Tap Show original to compare."
              : "Tap Show corrected to un-light this photo from the six card squares — same matrix the app used to call the result."
            : relitBusy
              ? "Building the lighting-corrected preview from this photo…"
              : autoDetected
                ? "The app found the card and sampled the gold boxes."
                : "Card not auto-detected, so these are the default framing boxes."}
        </p>
        <div className="shot-wrap">
          <img
            className="shot"
            src={showRelit && relitUrl ? relitUrl : props.imageDataUrl}
            alt={showRelit ? "Lighting-corrected field test" : "Captured field test"}
          />
          {!showRelit &&
            (autoDetected ? (
              <LayoutOverlay
                layout={overlayLayout}
                kitLabel={props.kitAutoFound ? "kit (found)" : "kit"}
              />
            ) : (
              <CaptureOverlay />
            ))}
        </div>
        {!showRelit && (
          <p className="muted" style={{ marginTop: "0.5rem" }}>
            {autoDetected
              ? "Gold boxes = the six card squares the app sampled. White box = the kit."
              : "Gold boxes are what the app actually read."}
          </p>
        )}
      </div>

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
