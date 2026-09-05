import { useEffect, useRef, useState } from "react"
import { classifyImage } from "../color/classify"
import { canvasToJpeg, loadImage, openRearCamera } from "../lib/camera"
import { readGps } from "../lib/gps"
import { sha256Hex } from "../lib/hash"
import { loadPrintRunRgb } from "../lib/printRun"
import { CALIBRATION_SHOTS, type CalibrationShotId } from "../lib/shots"
import { loadRecords, makeRecord, type TestRecord } from "../lib/store"
import { sealRecord } from "../lib/seal"
import { CaptureOverlay } from "./CaptureOverlay"

function drawCover(
  ctx: CanvasRenderingContext2D,
  source: CanvasImageSource,
  srcW: number,
  srcH: number,
) {
  const destW = ctx.canvas.width
  const destH = ctx.canvas.height
  const scale = Math.max(destW / srcW, destH / srcH)
  const dw = srcW * scale
  const dh = srcH * scale
  ctx.fillStyle = "#000"
  ctx.fillRect(0, 0, destW, destH)
  ctx.drawImage(source, (destW - dw) / 2, (destH - dh) / 2, dw, dh)
}

export function CaptureScreen(props: {
  officerId: string
  shotId: CalibrationShotId | ""
  onShotId: (id: CalibrationShotId | "") => void
  onCaptured: (record: TestRecord, classifiedJson: string) => void
  onLog: () => void
}) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const [error, setError] = useState<string | null>(null)
  const [busy, setBusy] = useState(false)
  const streamRef = useRef<MediaStream | null>(null)

  useEffect(() => {
    let cancelled = false
    openRearCamera()
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        const video = videoRef.current
        if (video) {
          video.srcObject = stream
          void video.play()
        }
      })
      .catch(() => setError("Camera blocked. Use Upload photo instead."))
    return () => {
      cancelled = true
      streamRef.current?.getTracks().forEach((t) => t.stop())
    }
  }, [])

  async function fromSource(source: CanvasImageSource, srcW: number, srcH: number) {
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
      drawCover(ctx, source, srcW, srcH)
      const pixels = ctx.getImageData(0, 0, w, h)
      const classified = classifyImage(pixels, { printRunRgb: loadPrintRunRgb() })
      const blob = await canvasToJpeg(canvas, 0.92)
      const bytes = await blob.arrayBuffer()
      const [hex, gps, dataUrl] = await Promise.all([
        sha256Hex(bytes),
        readGps(),
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
        gps,
        classified,
      })
      record.previousRecordHash = loadRecords()[0]?.seal?.payloadHash ?? null
      record.seal = await sealRecord(record)
      props.onCaptured(record, JSON.stringify(classified.debug, null, 2))
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
    await fromSource(video, video.videoWidth, video.videoHeight)
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
      <h1>Card in frame. Kit in the top box.</h1>
      <label htmlFor="shot">Calibration shot</label>
      <select
        id="shot"
        value={props.shotId}
        onChange={(e) => props.onShotId(e.target.value as CalibrationShotId | "")}
        style={{
          width: "100%",
          background: "#0d0d0d",
          color: "var(--text)",
          border: "1px solid var(--line)",
          padding: "0.65rem",
        }}
      >
        <option value="">Not a calibration shot</option>
        {CALIBRATION_SHOTS.map((s) => (
          <option key={s.id} value={s.id}>
            {s.label}
          </option>
        ))}
      </select>
      <div className="stage" ref={stageRef}>
        <video ref={videoRef} playsInline autoPlay muted />
        <CaptureOverlay />
      </div>
      {error ? <p className="muted">{error}</p> : null}
      <button className="primary" onClick={() => void snap()} disabled={busy}>
        {busy ? "Sealing photo…" : "Capture"}
      </button>
      <label className="ghost" style={{ display: "block", textAlign: "center", padding: "0.7rem", border: "1px solid var(--line)" }}>
        Upload photo
        <input
          type="file"
          accept="image/*"
          capture="environment"
          style={{ display: "none" }}
          onChange={(e) => void onFile(e.target.files?.[0])}
        />
      </label>
      <div className="row">
        <button className="ghost" onClick={() => void loadDemo("demo-positive.png")} disabled={busy}>
          Demo +
        </button>
        <button className="ghost" onClick={() => void loadDemo("demo-negative.png")} disabled={busy}>
          Demo −
        </button>
      </div>
      <button className="ghost" onClick={props.onLog}>
        Open log
      </button>
    </>
  )
}
