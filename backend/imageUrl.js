const BASE_URL = process.env.BASE_URL || ''

function imageVersion(value) {
  return value instanceof Date ? value.getTime() : ''
}

function isCloudinaryUrl(value) {
  return typeof value === 'string' && value.startsWith('http')
}

function getImageUrl(value, imageBase, id, field, updatedAt) {
  if (!value) return ''

  if (isCloudinaryUrl(value)) return value

  const v = imageVersion(updatedAt) || id
  return `${imageBase || BASE_URL}/api/images/teams/${id}/${field}${v ? `?v=${v}` : ''}`
}

module.exports = { getImageUrl, imageVersion, isCloudinaryUrl }
