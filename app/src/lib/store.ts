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
const MAX = 25

export function loadRecords(): TestRecord[] {
  try {
    const raw = localStorage.getItem(KEY)
    return raw ? (JSON.parse(raw) as TestRecord[]) : []
  } catch {
    return []
  }
}

function isQuotaError(e: unknown): boolean {
  return (
    e instanceof DOMException &&
    (e.name === "QuotaExceededError" ||
      e.name === "NS_ERROR_DOM_QUOTA_REACHED" ||
      e.code === 22 ||
      e.code === 1014)
  )
}

/**
 * Persist the newest-first list, self-trimming so the phone never dies on
 * "quota exceeded". Each record carries a full JPEG data URL, so localStorage
 * (~5 MB) fills up: on quota errors we drop the oldest records one at a time,
 * then as a last resort strip the debug blob from the single newest record.
 */
function persist(records: TestRecord[]): TestRecord[] {
  let list = records.slice(0, MAX)
  while (list.length > 0) {
    try {
      localStorage.setItem(KEY, JSON.stringify(list))
      return list
    } catch (e) {
      if (!isQuotaError(e)) throw e
      if (list.length > 1) {
        list = list.slice(0, list.length - 1) // evict the oldest test
      } else {
        const stripped: TestRecord[] = [{ ...list[0], debug: null }]
        localStorage.setItem(KEY, JSON.stringify(stripped)) // let it throw if even this fails
        return stripped
      }
    }
  }
  return list
}

export function saveRecord(record: TestRecord) {
  // The re-lit preview is large; keep it only in memory, not in localStorage.
  const slim: TestRecord = { ...record, relitImageDataUrl: null }
  persist([slim, ...loadRecords()])
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
  const saved = persist(all)
  return saved.find((r) => r.id === id) ?? all.find((r) => r.id === id) ?? null
}
