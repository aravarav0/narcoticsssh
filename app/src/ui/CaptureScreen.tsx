import { useEffect, useRef, useState } from "react"
import { classifyImage } from "../color/classify"
import { detectCard } from "../color/detect"
import { relightCanvas } from "../color/relight"
import { DEFAULT_LAYOUT } from "../color/constants"
import { canvasToJpeg, liveVideoTrack, loadImage, loadOrientedImage, openRearCamera, setTorch, torchSupported } from "../lib/camera"
import { readGps, type GpsFix } from "../lib/gps"
import { sha256Hex } from "../lib/hash"
import { loadClassLabs, loadPrintRunRgb } from "../lib/printRun"
import { CALIBRATION_SHOTS, type CalibrationShotId } from "../lib/shots"
import { loadRecords, makeRecord, type TestRecord } from "../lib/store"
import { sealRecord, type EvidenceSeal } from "../lib/seal"
import { CaptureOverlay } from "./CaptureOverlay"

function isIos() {
  return /iPhone|iPad|iPod/i.test(navigator.userAgent)
}

function isInsecureRemote() {
  return !window.isSecureContext && location.hostname !== "localhost" && location.hostname !== "127.0.0.1"
}

function phoneUrl() {
  return window.location.origin
}

function cameraErrorMessage(err: unknown) {
  if (isIos() && isInsecureRemote()) {
    return "iPhone Safari will not even ask for live camera on http://. Tap Take photo (opens Camera) — or reopen this page as https:// from the laptop terminal (Network address), then Show Details → Visit this website."
  }
  const msg = err instanceof Error ? err.message : ""
  if (/NotAllowed|Permission|denied/i.test(msg)) {
    return "Camera permission denied. In Safari: aA or the address-bar camera icon → Allow. Close other tabs using the camera."
  }
  if (/NotReadable|in use|TrackStart|Could not start/i.test(msg)) {
    return "Camera is on but another app or browser tab is using it. Close those, then tap Enable camera."
  }
  return "Live preview failed. On iPhone tap Take photo. That opens the Camera app and still classifies the colour."
}

async function attachStream(video: HTMLVideoElement, stream: MediaStream) {
  video.setAttribute("playsinline", "true")
  video.setAttribute("webkit-playsinline", "true")
  video.muted = true
  video.autoplay = true
  video.srcObject = stream
  if (video.readyState < 2) {
    await new Promise<void>((resolve) => {
      video.onloadedmetadata = () => resolve()
      window.setTimeout(() => resolve(), 1500)
    })
  }
  try {
    await video.play()
  } catch {
    /* autoplay can wait for Enable camera */
  }
}

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
  mirror = false,
) {
  const destW = ctx.canvas.width
  const destH = ctx.canvas.height
  const scale = Math.max(destW / srcW, destH / srcH)
  const dw = srcW * scale
  const dh = srcH * scale
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, destW, destH)
  ctx.save()
  if (mirror) {
    ctx.translate(destW, 0)
    ctx.scale(-1, 1)
  }
  ctx.drawImage(source, (destW - dw) / 2, (destH - dh) / 2, dw, dh)
  ctx.restore()
}

export function CaptureScreen(props: {
  officerId: string
  shotId: CalibrationShotId | ""
  onShotId: (id: CalibrationShotId | "") => void
  onCaptured: (record: TestRecord) => void
  onGps: (id: string, gps: GpsFix | null) => void
  onSeal: (id: string, seal: EvidenceSeal) => void
  onLog: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const [mirror, setMirror] = useState(() => sessionStorage.getItem("sih26231.mirror") !== "off")
  const [copiedUrl, setCopiedUrl] = useState(false)
  const [torchOn, setTorchOn] = useState(false)
  const [torchAvailable, setTorchAvailable] = useState(false)
  const [flashHint, setFlashHint] = useState<string | null>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const torchOnRef = useRef(false)

  function probeTorch(stream: MediaStream) {
    const track = liveVideoTrack(stream)
    const ok = torchSupported(track)
    setTorchAvailable(ok)
    if (ok && torchOnRef.current) void setTorch(track, true)
  }

  async function toggleFlash() {
    const track = liveVideoTrack(streamRef.current)
    if (!torchSupported(track)) {
      setFlashHint(
        isIos()
          ? "Safari cannot turn the iPhone flash on from this page. Tap Take photo, then in Camera tap the lightning bolt for flash."
          : "This browser’s live camera has no torch. Use Take photo and turn flash on in the Camera app.",
      )
      return
    }
    const next = !torchOnRef.current
    const ok = await setTorch(track, next)
    torchOnRef.current = ok && next
    setTorchOn(ok && next)
    setFlashHint(ok ? null : "Torch refused. Try Enable live camera again, or use Camera-app flash.")
  }

  function toggleMirror() {
    setMirror((on) => {
      const next = !on
      sessionStorage.setItem("sih26231.mirror", next ? "on" : "off")
      return next
    })
  }

  async function startCamera() {
    setError(null)
    try {
      const stream = await openRearCamera()
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = stream
      probeTorch(stream)
      const video = videoRef.current
      if (video) await attachStream(video, stream)
    } catch (err) {
      setError(cameraErrorMessage(err))
    }
  }

  useEffect(() => {
    if (isIos()) {
      if (isInsecureRemote()) {
        setError(
          "iPhone will not prompt for live camera on http://. Tap Take photo below — that opens Camera and still runs the colour test. For live preview: on the laptop terminal copy the Network https:// address, open it in Safari, tap Show Details → Visit this website, then Enable camera.",
        )
      }
      return
    }
    let cancelled = false
    void (async () => {
      try {
        const stream = await openRearCamera()
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = stream
        probeTorch(stream)
        const video = videoRef.current
        if (video) await attachStream(video, stream)
      } catch (err) {
        if (!cancelled) setError(cameraErrorMessage(err))
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function fromSource(
    source: CanvasImageSource,
    srcW: number,
    srcH: number,
    opts?: { mirror?: boolean; fit?: "cover" | "native" },
  ) {
    setBusy(true)
    setError(null)
    try {
      const mirror = opts?.mirror ?? false
      const fit = opts?.fit ?? "cover"
      const stage = stageRef.current
      const canvas = document.createElement("canvas")
      if (fit === "native") {
        const maxSide = 1600
        const s = Math.min(1, maxSide / Math.max(srcW, srcH))
        canvas.width = Math.max(2, Math.round(srcW * s))
        canvas.height = Math.max(2, Math.round(srcH * s))
      } else {
        canvas.width = Math.max(360, Math.round((stage?.clientWidth ?? 360) * 2))
        canvas.height = Math.max(480, Math.round((stage?.clientHeight ?? 480) * 2))
      }
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) throw new Error("no canvas")
      if (fit === "native") {
        ctx.drawImage(source, 0, 0, canvas.width, canvas.height)
      } else {
        drawCover(ctx, source, srcW, srcH, mirror)
      }
      const pixels = ctx.getImageData(0, 0, canvas.width, canvas.height)
      const detected = detectCard(pixels)
      const classified = classifyImage(pixels, {
        layout: detected?.layout ?? DEFAULT_LAYOUT,
        printRunRgb: loadPrintRunRgb(),
        classLabs: loadClassLabs(),
      })
      const relitImageDataUrl = classified.debug.ccmMatrix
        ? relightCanvas(canvas, classified.debug.ccmMatrix)
        : null
      const blob = await canvasToJpeg(canvas, 0.92)
      const bytes = await blob.arrayBuffer()
      const [hex, dataUrl] = await Promise.all([
        sha256Hex(bytes),
        new Promise<string>((resolve) => {
          const reader = new FileReader()
          reader.onload = () => resolve(String(reader.result))
          reader.readAsDataURL(blob)
        }),
      ])
      const record = makeRecord({
        officerId: props.officerId,
        imageDataUrl: dataUrl,
        sha256Hex: hex,
        gps: null,
        classified,
        detectedLayout: detected?.layout ?? null,
        kitAutoFound: detected?.kitAutoFound ?? false,
        relitImageDataUrl,
      })
      record.previousRecordHash = loadRecords()[0]?.seal?.payloadHash ?? null
      props.onCaptured(record)
      void (async () => {
        const gps = await readGps()
        props.onGps(record.id, gps)
        const seal = await sealRecord({
          ...record,
          lat: gps?.lat ?? null,
          lon: gps?.lon ?? null,
          gpsAccuracyM: gps?.accuracyM ?? null,
        })
        props.onSeal(record.id, seal)
      })()
    } catch (err) {
      setError(err instanceof Error ? err.message : "Capture failed")
    } finally {
      setBusy(false)
    }
  }

  async function snap() {
    const video = videoRef.current
    if (!video || video.readyState < 2) {
      setError("Wait for the camera preview.")
      return
    }
    await fromSource(video, video.videoWidth, video.videoHeight, { mirror, fit: "cover" })
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const oriented = await loadOrientedImage(file)
    await fromSource(oriented.source, oriented.width, oriented.height, { fit: "native" })
  }

  async function loadDemo(name: "demo-positive.png" | "demo-negative.png" | "demo-black.png") {
    const img = await loadImage(`/${name}`)
    await fromSource(img, img.naturalWidth, img.naturalHeight, { fit: "native" })
  }

  return (
    <>
      <p className="kicker">SIH26231 · capture</p>
      <h1>Get the card and kit in one photo.</h1>
      <p className="muted">
        Put the six‑square card and the kit square in the same frame — the app{" "}
        <strong>finds the card by itself</strong>, reconstructs all six squares, and reads the kit
        above it. Framing boxes below are only a hint. It corrects the lighting from the card, so any
        lamp is fine. Dummy test: <strong>purple / lavender = positive</strong>,{" "}
        <strong>white = negative</strong>. Tilt to kill glare.
      </p>
      <div className="stage" ref={stageRef}>
        <video
          ref={videoRef}
          className={mirror ? "mirrored" : undefined}
          playsInline
          webkit-playsinline="true"
          autoPlay
          muted
        />
        <CaptureOverlay />
        <button
          type="button"
          className={`mirror-toggle flash-toggle${torchOn ? " on" : ""}`}
          onClick={() => void toggleFlash()}
          disabled={busy}
          aria-pressed={torchOn}
          title={
            torchAvailable
              ? "Toggle the phone torch on the live camera"
              : "Live torch not available — tap for how to use Camera flash"
          }
        >
          {torchOn ? "Flash on" : "Flash"}
        </button>
        <button
          type="button"
          className={`mirror-toggle${mirror ? " on" : ""}`}
          onClick={toggleMirror}
          disabled={busy}
          aria-pressed={mirror}
        >
          {mirror ? "Mirror on" : "Mirror off"}
        </button>
        {busy ? (
          <div className="analyzing">
            <div className="analyzing-pulse" />
            <p>Reading colour…</p>
          </div>
        ) : null}
      </div>
      {error ? <p className="error">{error}</p> : null}
      {flashHint ? <p className="muted">{flashHint}</p> : null}
      <label className="primary file-btn">
        Take photo (iPhone — use this)
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      <button className="ghost" onClick={() => void startCamera()} disabled={busy}>
        Enable live camera
      </button>
      <button className="ghost" onClick={() => void snap()} disabled={busy}>
        {busy ? "Reading colour…" : "Capture live preview"}
      </button>
      <PhoneLinkCard copied={copiedUrl} onCopied={setCopiedUrl} />
      <div className="demo-card">
        <div className="demo-card-title">Demo (no camera or card needed)</div>
        <div className="row">
          <button className="ghost" onClick={() => void loadDemo("demo-positive.png")} disabled={busy}>
            Demo purple (+)
          </button>
          <button className="ghost" onClick={() => void loadDemo("demo-negative.png")} disabled={busy}>
            Demo white (−)
          </button>
          <button className="ghost" onClick={() => void loadDemo("demo-black.png")} disabled={busy}>
            Demo black
          </button>
        </div>
      </div>
      <details className="more">
        <summary>Calibration</summary>
        <label htmlFor="shot">Calibration shot name</label>
        <select
          id="shot"
          value={props.shotId}
          onChange={(e) => props.onShotId(e.target.value as CalibrationShotId | "")}
        >
          <option value="">Off — normal capture</option>
          {CALIBRATION_SHOTS.map((s) => (
            <option key={s.id} value={s.id}>
              {s.label}
            </option>
          ))}
        </select>
      </details>
      <button className="ghost" onClick={props.onLog}>
        Open log
      </button>
    </>
  )
}

function PhoneLinkCard(props: { copied: boolean; onCopied: (v: boolean) => void }) {
  const href = phoneUrl()
  const loopback =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
  const onIphone = isIos()

  async function copy() {
    try {
      await navigator.clipboard.writeText(href)
      props.onCopied(true)
      window.setTimeout(() => props.onCopied(false), 1500)
    } catch {
      props.onCopied(false)
    }
  }

  return (
    <div className="demo-card">
      <div className="demo-card-title">iPhone camera</div>
      {onIphone ? (
        <p className="muted">
          Tap the green <strong>Take photo</strong> button — Safari opens the Camera app. That
          works on http. Live preview needs https: laptop terminal → Network address starting
          with https:// → Safari → Show Details → Visit this website → then Enable live camera.
        </p>
      ) : (
        <>
          <p className="muted">
            Same Wi‑Fi. In the laptop terminal copy the <strong>Network</strong> address that
            starts with https:// (not localhost). On iPhone Safari: Show Details → Visit this
            website. Then Allow Camera, or just use Take photo.
          </p>
          {!loopback ? (
            <img
              className="phone-qr"
              alt="QR code to open the app on iPhone"
              src={`https://api.qrserver.com/v1/create-qr-code/?size=168x168&data=${encodeURIComponent(href)}`}
            />
          ) : null}
          <p className="mono">{href}</p>
          <button type="button" className="ghost" onClick={() => void copy()}>
            {props.copied ? "Copied" : "Copy iPhone link"}
          </button>
        </>
      )}
    </div>
  )
}
