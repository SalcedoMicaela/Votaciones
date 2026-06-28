const crypto = require('crypto')

// Hash de contraseña con scrypt (sin dependencias externas).
// Formato almacenado: "<salt-hex>:<hash-hex>"
function hashPassword(password) {
  const salt = crypto.randomBytes(16).toString('hex')
  const hash = crypto.scryptSync(String(password), salt, 64).toString('hex')
  return `${salt}:${hash}`
}

function verifyPassword(password, stored) {
  if (!stored || !stored.includes(':')) return false
  const [salt, key] = stored.split(':')
  const hash = crypto.scryptSync(String(password), salt, 64)
  const keyBuf = Buffer.from(key, 'hex')
  if (keyBuf.length !== hash.length) return false
  return crypto.timingSafeEqual(keyBuf, hash)
}

module.exports = { hashPassword, verifyPassword }
