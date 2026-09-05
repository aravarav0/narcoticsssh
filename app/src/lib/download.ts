export function downloadNamed(filename: string, blob: Blob) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement("a")
  a.href = url
  a.download = filename
  a.click()
  URL.revokeObjectURL(url)
}

export function downloadDataUrl(filename: string, dataUrl: string) {
  const a = document.createElement("a")
  a.href = dataUrl
  a.download = filename
  a.click()
}

export function downloadJson(filename: string, value: unknown) {
  downloadNamed(filename, new Blob([JSON.stringify(value, null, 2)], { type: "application/json" }))
}
