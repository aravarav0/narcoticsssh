import { DEFAULT_LAYOUT } from "../color/constants"
import type { Layout, RectNorm } from "../color/types"

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
  return <LayoutOverlay layout={DEFAULT_LAYOUT} kitLabel="fill kit" />
}

/** Draws boxes for any layout — used with the auto-detected layout on results. */
export function LayoutOverlay({ layout, kitLabel = "kit" }: { layout: Layout; kitLabel?: string }) {
  const p = layout.patches
  return (
    <div className="overlay">
      <Box kit rect={layout.kit} label={kitLabel} />
      <Box rect={p.white} label="white" />
      <Box rect={p.gray} label="gray" />
      <Box rect={p.red} label="red" />
      <Box rect={p.black} label="black" />
      <Box rect={p.yellow} label="yellow" />
      <Box rect={p.purple} label="purple" />
    </div>
  )
}
