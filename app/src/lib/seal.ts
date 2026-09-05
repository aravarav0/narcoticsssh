/**
 * Browser-native evidence sealing. The private P-256 key is non-extractable and
 * persisted in IndexedDB; exports carry only the public key needed to verify.
 * This is deliberately a signature + hash chain, not a blockchain.
 */
import { sha256Hex } from "./hash"

const DB = "sih26231.evidence-keys"
const STORE = "keys"
const KEY = "device-signing-key-v1"

export type EvidenceSeal = {
  version: 1
  algorithm: "ECDSA-P256-SHA256"
  keyId: string
  publicKeyJwk: JsonWebKey
  payloadHash: string
  signatureBase64: string
}

export type SealableRecord = {
  id: string
  officerId: string
  capturedAt: string
  lat: number | null
  lon: number | null
  gpsAccuracyM: number | null
  sha256Hex: string
  result: string
  presumptive: true
  method: string
  flags: string[]
  previousRecordHash: string | null
}

function canonicalPayload(record: SealableRecord) {
  return JSON.stringify({
    capturedAt: record.capturedAt,
    flags: [...record.flags].sort(),
    gpsAccuracyM: record.gpsAccuracyM,
    id: record.id,
    lat: record.lat,
    lon: record.lon,
    method: record.method,
    officerId: record.officerId,
    previousRecordHash: record.previousRecordHash,
    presumptive: true,
    result: record.result,
    sha256Hex: record.sha256Hex,
    schema: "SIH26231/evidence-v1",
  })
}

function base64(bytes: ArrayBuffer) {
  let binary = ""
  for (const byte of new Uint8Array(bytes)) binary += String.fromCharCode(byte)
  return btoa(binary)
}

function fromBase64(value: string) {
  const binary = atob(value)
  return Uint8Array.from(binary, (char) => char.charCodeAt(0)).buffer
}

function openDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1)
    request.onupgradeneeded = () => request.result.createObjectStore(STORE)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result)
  })
}

async function getDeviceKey(): Promise<CryptoKeyPair> {
  const db = await openDb()
  const saved = await new Promise<CryptoKeyPair | undefined>((resolve, reject) => {
    const request = db.transaction(STORE, "readonly").objectStore(STORE).get(KEY)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve(request.result as CryptoKeyPair | undefined)
  })
  if (saved) return saved

  const pair = (await crypto.subtle.generateKey(
    { name: "ECDSA", namedCurve: "P-256" },
    false,
    ["sign", "verify"],
  )) as CryptoKeyPair
  await new Promise<void>((resolve, reject) => {
    const request = db.transaction(STORE, "readwrite").objectStore(STORE).put(pair, KEY)
    request.onerror = () => reject(request.error)
    request.onsuccess = () => resolve()
  })
  return pair
}

export async function sealRecord(record: SealableRecord): Promise<EvidenceSeal> {
  const payload = canonicalPayload(record)
  const payloadBytes = new TextEncoder().encode(payload)
  const pair = await getDeviceKey()
  const publicKeyJwk = await crypto.subtle.exportKey("jwk", pair.publicKey)
  const keyId = (await sha256Hex(new TextEncoder().encode(JSON.stringify(publicKeyJwk)).buffer)).slice(0, 16)
  const signature = await crypto.subtle.sign({ name: "ECDSA", hash: "SHA-256" }, pair.privateKey, payloadBytes)
  return {
    version: 1,
    algorithm: "ECDSA-P256-SHA256",
    keyId,
    publicKeyJwk,
    payloadHash: await sha256Hex(payloadBytes.buffer),
    signatureBase64: base64(signature),
  }
}

export async function verifyRecordSeal(record: SealableRecord, seal: EvidenceSeal | undefined): Promise<boolean> {
  if (!seal || seal.version !== 1 || seal.algorithm !== "ECDSA-P256-SHA256") return false
  const payload = canonicalPayload(record)
  const payloadBytes = new TextEncoder().encode(payload)
  if ((await sha256Hex(payloadBytes.buffer)) !== seal.payloadHash) return false
  const publicKey = await crypto.subtle.importKey(
    "jwk",
    seal.publicKeyJwk,
    { name: "ECDSA", namedCurve: "P-256" },
    true,
    ["verify"],
  )
  return crypto.subtle.verify(
    { name: "ECDSA", hash: "SHA-256" },
    publicKey,
    fromBase64(seal.signatureBase64),
    payloadBytes,
  )
}

export function evidencePayload(record: SealableRecord, seal: EvidenceSeal | undefined) {
  return { record: JSON.parse(canonicalPayload(record)), seal }
}
