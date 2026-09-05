import type { ClassifyDebug, ClassifyOutput, Layout, ResultLabel } from "../color/types"
import type { GpsFix } from "./gps"
import type { EvidenceSeal } from "./seal"

export type TestRecord = {
  id: string
  officerId: string
  capturedAt: string
  lat: number | null
  lon: number | null
  gpsAccuracyM: number | null
  imageDataUrl: string
  sha256Hex: string
  result: ResultLabel
  presumptive: true
  method: ClassifyOutput["debug"]["method"]
  flags: string[]
  notes: string
  debug: ClassifyDebug | null
  /** Where the app actually sampled (auto-detected card + kit), normalised. */
  detectedLayout?: Layout | null
  /** True when a coloured kit was found on its own (vs. a fallback box). */
  kitAutoFound?: boolean
  /** In-memory only: the frame re-lit with the CCM. Not persisted (too big). */
  relitImageDataUrl?: string | null
  /** SHA-256 of the preceding signed payload. Makes record reordering visible. */
  previousRecordHash: string | null
  seal?: EvidenceSeal
}

const KEY = "sih26231.records"
const MAX = 40

export function loadRecords(): TestRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TestRecord[]) : []
  } catch {
    return []
  }
}

export function saveRecord(record: TestRecord) {
  // The re-lit preview is large; keep it only in memory, not in localStorage.
  const slim: TestRecord = { ...record, relitImageDataUrl: null }
  const all = [slim, ...loadRecords()].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function makeRecord(input: {
  officerId: string
  imageDataUrl: string
  sha256Hex: string
  gps: GpsFix | null
  classified: ClassifyOutput
  detectedLayout?: Layout | null
  kitAutoFound?: boolean
  relitImageDataUrl?: string | null
}): TestRecord {
  return {
    id: crypto.randomUUID(),
    officerId: input.officerId,
    capturedAt: new Date().toISOString(),
    lat: input.gps?.lat ?? null,
    lon: input.gps?.lon ?? null,
    gpsAccuracyM: input.gps?.accuracyM ?? null,
    imageDataUrl: input.imageDataUrl,
    sha256Hex: input.sha256Hex,
    result: input.classified.result,
    presumptive: true,
    method: input.classified.debug.method,
    flags: input.classified.debug.qualityFlags,
    notes: "",
    debug: input.classified.debug,
    detectedLayout: input.detectedLayout ?? null,
    kitAutoFound: input.kitAutoFound ?? false,
    relitImageDataUrl: input.relitImageDataUrl ?? null,
    previousRecordHash: null,
  }
}

export function patchRecord(id: string, patch: Partial<TestRecord>) {
  const all = loadRecords().map((r) => (r.id === id ? { ...r, ...patch } : r))
  localStorage.setItem(KEY, JSON.stringify(all))
  return all.find((r) => r.id === id) ?? null
}
