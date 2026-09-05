import { DEFAULT_LAYOUT } from "../color/constants"
import type { RectNorm } from "../color/types"

function Box({ rect, label, kit }: { rect: RectNorm; label: string; kit?: boolean }) {
  return (
    <div
      className={kit ? "box kit" : "box"}
      style={{
        left: `${rect.x * 100}%`,
        top: `${rect.y * 100}%`,
        width: `${rect.w * 100}%`,
        height: `${rect.h * 100}%`,
      }}
    >
      {label}
    </div>
  )
}

export function CaptureOverlay() {
  const p = DEFAULT_LAYOUT.patches
  return (
    <div className="overlay">
      <Box kit rect={DEFAULT_LAYOUT.kit} label="kit here" />
      <Box rect={p.white} label="white" />
      <Box rect={p.gray} label="gray" />
      <Box rect={p.red} label="red" />
      <Box rect={p.black} label="black" />
      <Box rect={p.yellow} label="yellow" />
      <Box rect={p.purple} label="purple" />
    </div>
  )
}
