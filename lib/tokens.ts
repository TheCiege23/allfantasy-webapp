import crypto from "crypto"

export function sha256Hex(input: string) {
  return crypto.createHash("sha256").update(input).digest("hex")
}

export function makeToken(bytes = 32) {
  return crypto.randomBytes(bytes).toString("base64url")
}

export function isStrongPassword(pw: string) {
  if (pw.length < 8) return false
  return /[A-Za-z]/.test(pw) && /[0-9]/.test(pw)
}
