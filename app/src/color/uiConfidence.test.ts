import { describe, expect, it } from "vitest"
import resultSrc from "../ui/ResultView.tsx?raw"
import appSrc from "../App.tsx?raw"
import classifySrc from "./classify.ts?raw"
import typesSrc from "./types.ts?raw"

describe("no fabricated confidence percentage in the UI", () => {
  it("does not render a 0–100 confidence score", () => {
    for (const [name, src] of [
      ["ResultView.tsx", resultSrc],
      ["App.tsx", appSrc],
      ["classify.ts", classifySrc],
      ["types.ts", typesSrc],
    ] as const) {
      expect(src, name).not.toMatch(/confidenceScore/)
      expect(src, name).not.toMatch(/confidence\s*%/)
      expect(src, name).not.toMatch(/confidence percentage/i)
    }
  })
})
