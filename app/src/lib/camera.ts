/** Best-effort lock. iOS Safari ignores this; the colour card is the real calibration. */
export async function tryLockCamera(track: MediaStreamTrack) {
  try {
    await track.applyConstraints({
      advanced: [{ whiteBalanceMode: "manual" }, { exposureMode: "manual" }],
    } as unknown as MediaTrackConstraints)
  } catch {
    /* not supported — continue */
  }
}

export async function openRearCamera(): Promise<MediaStream> {
  const stream = await navigator.mediaDevices.getUserMedia({
    audio: false,
    video: {
      facingMode: { ideal: "environment" },
      width: { ideal: 1280 },
      height: { ideal: 720 },
    },
  })
  const track = stream.getVideoTracks()[0]
  if (track) await tryLockCamera(track)
  return stream
}

export function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(reader.error)
    reader.readAsDataURL(blob)
  })
}

export function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.onload = () => resolve(img)
    img.onerror = () => reject(new Error("image load failed"))
    img.src = url
  })
}

export function drawToCanvas(
  source: CanvasImageSource,
  width: number,
  height: number,
): { canvas: HTMLCanvasElement; pixels: ImageData } {
  const canvas = document.createElement("canvas")
  canvas.width = width
  canvas.height = height
  const ctx = canvas.getContext("2d", { willReadFrequently: true })
  if (!ctx) throw new Error("no 2d context")
  ctx.drawImage(source, 0, 0, width, height)
  return { canvas, pixels: ctx.getImageData(0, 0, width, height) }
}

export function canvasToJpeg(canvas: HTMLCanvasElement, quality = 0.92): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("toBlob failed"))), "image/jpeg", quality)
  })
}
