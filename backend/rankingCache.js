const cache = new Map()
const TTL_MS = 3000

async function getCached(key, loader) {
  const now = Date.now()
  const hit = cache.get(key)
  if (hit && hit.expiresAt > now) return hit.value

  const value = await loader()
  cache.set(key, { value, expiresAt: now + TTL_MS })
  return value
}

function clearRankingCache() {
  cache.clear()
}

module.exports = { getCached, clearRankingCache }
