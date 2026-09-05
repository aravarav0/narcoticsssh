export async function sha256Hex(bytes: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", bytes)
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("")
}

/** Flip one byte so the demo can show the hash changing. */
export function flipFirstByte(bytes: ArrayBuffer): ArrayBuffer {
  const copy = new Uint8Array(bytes.slice(0))
  copy[0] = copy[0] ^ 0xff
  return copy.buffer
}
