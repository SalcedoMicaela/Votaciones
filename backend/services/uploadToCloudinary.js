const cloudinary = require('../cloudinary')

async function uploadToCloudinary(dataUrl, publicId) {
  if (!dataUrl || typeof dataUrl !== 'string') return null

  if (dataUrl.startsWith('http')) return dataUrl

  const result = await cloudinary.uploader.upload(dataUrl, {
    public_id: publicId,
    overwrite: true,
    invalidate: true,
    resource_type: 'image',
  })

  return result.secure_url
}

module.exports = { uploadToCloudinary }
