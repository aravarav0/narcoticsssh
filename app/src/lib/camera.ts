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

async function getStream(video: boolean | MediaTrackConstraints): Promise<MediaStream> {
  if (!navigator.mediaDevices?.getUserMedia) {
    throw new Error("Camera API missing. Use Chrome/Edge on http://localhost, or Take photo.")
  }
  return navigator.mediaDevices.getUserMedia({ audio: false, video })
}

function isPhone() {
  return /iPhone|iPad|iPod|Android/i.test(navigator.userAgent)
}

function isIrCamera(label: string) {
  return /\bir\b|infrared|windows hello|rgb.?ir/i.test(label)
}

async function preferredDeviceId(): Promise<string | undefined> {
  const cams = (await navigator.mediaDevices.enumerateDevices()).filter((d) => d.kind === "videoinput")
  const rgb = cams.filter((d) => !isIrCamera(d.label))
  const pool = rgb.length ? rgb : cams
  if (isPhone()) {
    const back = pool.find((d) => /back|rear|environment/i.test(d.label))
    return (back ?? pool[0])?.deviceId
  }
  return pool[0]?.deviceId
}

/** RGB webcam on laptops (skip Windows Hello IR). Rear camera on phones. */
export async function openRearCamera(): Promise<MediaStream> {
  const phone = isPhone()
  const first: MediaTrackConstraints = phone
    ? { facingMode: { ideal: "environment" }, width: { ideal: 1280 }, height: { ideal: 720 } }
    : { facingMode: { ideal: "user" }, width: { ideal: 1280 }, height: { ideal: 720 } }
  const attempts: Array<boolean | MediaTrackConstraints> = [first, true]
  let last: unknown
  let stream: MediaStream | null = null
  for (const video of attempts) {
    try {
      stream = await getStream(video)
      break
    } catch (err) {
      last = err
    }
  }
  if (!stream) throw last instanceof Error ? last : new Error("Camera blocked")

  const label = stream.getVideoTracks()[0]?.label ?? ""
  if (isIrCamera(label) || !label) {
    const id = await preferredDeviceId()
    if (id && id !== stream.getVideoTracks()[0]?.getSettings().deviceId) {
      stream.getTracks().forEach((t) => t.stop())
      stream = await getStream({ deviceId: { exact: id } })
    }
  }
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

/** iPhone JPEGs store orientation in EXIF. Use the upright pixels for sampling. */
export async function loadOrientedImage(file: File): Promise<{
  source: CanvasImageSource
  width: number
  height: number
}> {
  try {
    const bitmap = await createImageBitmap(file, { imageOrientation: "from-image" })
    return { source: bitmap, width: bitmap.width, height: bitmap.height }
  } catch {
    const url = URL.createObjectURL(file)
    try {
      const img = await loadImage(url)
      return { source: img, width: img.naturalWidth, height: img.naturalHeight }
    } finally {
      URL.revokeObjectURL(url)
    }
  }
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
