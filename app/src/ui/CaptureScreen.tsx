import { useEffect, useRef, useState } from "react"
import { classifyImage } from "../color/classify"
import { canvasToJpeg, loadImage, openRearCamera } from "../lib/camera"
import { readGps, type GpsFix } from "../lib/gps"
import { sha256Hex } from "../lib/hash"
import { loadClassLabs, loadPrintRunRgb } from "../lib/printRun"
import { CALIBRATION_SHOTS, type CalibrationShotId } from "../lib/shots"
import { loadRecords, makeRecord, type TestRecord } from "../lib/store"
import { sealRecord, type EvidenceSeal } from "../lib/seal"
import { CaptureOverlay } from "./CaptureOverlay"

function phoneHttpsUrl() {
  const host = window.location.hostname
  const port = window.location.port
  const portPart = port ? `:${port}` : ""
  if (host !== "localhost" && host !== "127.0.0.1") {
    return `https://${host}${portPart}`
  }
  return window.location.origin
}

function cameraErrorMessage(err: unknown) {
  if (!window.isSecureContext) {
    return "Safari blocks live camera on http://. Open the https:// iPhone link, or tap Take photo."
  }
  const msg = err instanceof Error ? err.message : ""
  if (/NotAllowed|Permission|denied/i.test(msg)) {
    return "Camera permission denied. In Safari: aA → Website Settings → Camera → Allow. Or tap Take photo."
  }
  return "Live camera unavailable. Tap Take photo — that uses the iPhone camera."
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
  const streamRef = useRef<MediaStream | null>(null)

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
      const video = videoRef.current
      if (video) {
        video.setAttribute("playsinline", "true")
        video.setAttribute("webkit-playsinline", "true")
        video.srcObject = stream
        await video.play()
      }
    } catch (err) {
      setError(cameraErrorMessage(err))
    }
  }

  useEffect(() => {
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
        const video = videoRef.current
        if (video) {
          video.setAttribute("playsinline", "true")
          video.setAttribute("webkit-playsinline", "true")
          video.srcObject = stream
          await video.play()
        }
      } catch (err) {
        if (!cancelled) setError(cameraErrorMessage(err))
      }
    })()
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function fromSource(source: CanvasImageSource, srcW: number, srcH: number, mirror = false) {
    setBusy(true)
    setError(null)
    try {
      const stage = stageRef.current
      const w = Math.max(360, Math.round((stage?.clientWidth ?? 360) * 2))
      const h = Math.max(480, Math.round((stage?.clientHeight ?? 480) * 2))
      const canvas = document.createElement("canvas")
      canvas.width = w
      canvas.height = h
      const ctx = canvas.getContext("2d", { willReadFrequently: true })
      if (!ctx) throw new Error("no canvas")
      drawCover(ctx, source, srcW, srcH, mirror)
      const pixels = ctx.getImageData(0, 0, w, h)
      const classified = classifyImage(pixels, {
        printRunRgb: loadPrintRunRgb(),
        classLabs: loadClassLabs(),
      })
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
    await fromSource(video, video.videoWidth, video.videoHeight, mirror)
  }

  async function onFile(file: File | undefined) {
    if (!file) return
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      await fromSource(img, img.naturalWidth, img.naturalHeight)
    } finally {
      URL.revokeObjectURL(url)
    }
  }

  async function loadDemo(name: "demo-positive.png" | "demo-negative.png") {
    const img = await loadImage(`/${name}`)
    await fromSource(img, img.naturalWidth, img.naturalHeight)
  }

  return (
    <>
      <p className="kicker">SIH26231 · capture</p>
      <h1>Hold the pocket card under the kit.</h1>
      <p className="muted">
        One card, one photo. Fill the white <strong>FILL KIT</strong> box with the test square only —
        not your face. Fill each gold box with that colour. Tilt to kill glare.
      </p>
      <div className="stage" ref={stageRef}>
        <video ref={videoRef} className={mirror ? "mirrored" : undefined} playsInline autoPlay muted />
        <CaptureOverlay />
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
      {error ? (
        <>
          <p className="error">{error}</p>
          <button className="ghost" onClick={() => void startCamera()} disabled={busy}>
            Enable camera
          </button>
        </>
      ) : null}
      <button className="primary" onClick={() => void snap()} disabled={busy}>
        {busy ? "Reading colour…" : "Capture & classify"}
      </button>
      <label className="ghost file-btn">
        Take photo (iPhone camera)
        <input
          type="file"
          accept="image/*"
          capture="environment"
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      <PhoneLinkCard copied={copiedUrl} onCopied={setCopiedUrl} />
      <div className="demo-card">
        <div className="demo-card-title">Demo (no camera or card needed)</div>
        <div className="row">
          <button className="ghost" onClick={() => void loadDemo("demo-positive.png")} disabled={busy}>
            Demo positive
          </button>
          <button className="ghost" onClick={() => void loadDemo("demo-negative.png")} disabled={busy}>
            Demo negative
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
  const href = phoneHttpsUrl()
  const loopback =
    location.hostname === "localhost" || location.hostname === "127.0.0.1"
  const onIphone = /iPhone|iPad|iPod/i.test(navigator.userAgent)

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
          You are on the phone. Tap <strong>Allow</strong> for Camera, then Capture. If live view
          fails, tap Take photo — Safari opens the rear camera.
        </p>
      ) : (
        <>
          <p className="muted">
            Same Wi‑Fi as this laptop. In Safari open the <strong>Network</strong> https:// address
            from the terminal (not localhost). If it says Not Private: Show Details → Visit this
            website. Then Allow Camera.
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
