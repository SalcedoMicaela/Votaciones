// Redimensiona y comprime una imagen (File) y devuelve un data URL.
// Mantiene PNG (para conservar transparencia en logos) y usa JPEG para fotos.
export function resizeImage(file, { maxSize = 1200, quality = 0.82 } = {}) {
  return new Promise((resolve, reject) => {
    if (!file) return reject(new Error('No file'))
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('No se pudo leer el archivo'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error('Archivo de imagen inválido'))
      img.onload = () => {
        let { width, height } = img
        const longest = Math.max(width, height)
        if (longest > maxSize) {
          const scale = maxSize / longest
          width = Math.round(width * scale)
          height = Math.round(height * scale)
        }
        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)
        const isPng = file.type === 'image/png'
        const mime = isPng ? 'image/png' : 'image/jpeg'
        resolve(canvas.toDataURL(mime, quality))
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}
