const cloudName = (process.env.CLOUDINARY_URL || '').split('@')[1] || ''

function imageVersion(value) {
  return value instanceof Date ? value.getTime() : ''
}

function isCloudinaryUrl(value) {
  return typeof value === 'string' && value.startsWith('http')
}

function getImageUrl(updatedAt, imageBase, id, field) {
  if (!updatedAt) return ''

  const v = imageVersion(updatedAt) || id

  if (cloudName) {
    return `https://res.cloudinary.com/${cloudName}/image/upload/v${v}/teams/${id}/${field}`
  }

  const base = imageBase || process.env.BASE_URL || ''
  return `${base}/api/images/teams/${id}/${field}${v ? `?v=${v}` : ''}`
}

module.exports = { getImageUrl, imageVersion, isCloudinaryUrl }
