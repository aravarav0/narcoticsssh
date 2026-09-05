import type { ClassifyOutput, ResultLabel } from "../color/types"
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
  const all = [record, ...loadRecords()].slice(0, MAX)
  localStorage.setItem(KEY, JSON.stringify(all))
}

export function makeRecord(input: {
  officerId: string
  imageDataUrl: string
  sha256Hex: string
  gps: GpsFix | null
  classified: ClassifyOutput
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
    previousRecordHash: null,
  }
}
