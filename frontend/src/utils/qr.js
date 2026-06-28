// Convierte un elemento <svg> (el QR) a un data URL PNG
export function svgToPngDataUrl(svgEl, size = 600) {
  return new Promise((resolve, reject) => {
    if (!svgEl) return reject(new Error('No SVG'))
    const xml = new XMLSerializer().serializeToString(svgEl)
    const svg64 = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(xml)))
    const img = new Image()
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = size
      canvas.height = size
      const ctx = canvas.getContext('2d')
      ctx.fillStyle = '#ffffff'
      ctx.fillRect(0, 0, size, size)
      ctx.drawImage(img, 0, 0, size, size)
      resolve(canvas.toDataURL('image/png'))
    }
    img.onerror = () => reject(new Error('No se pudo renderizar el QR'))
    img.src = svg64
  })
}

export function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement('a')
  a.href = dataUrl
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
}

// Descarga el QR (por id de contenedor) como PNG
export async function downloadQr(containerId, filename) {
  const svg = document.querySelector(`#${containerId} svg`)
  if (!svg) return
  const dataUrl = await svgToPngDataUrl(svg, 600)
  downloadDataUrl(dataUrl, filename)
}

// Construye un link de WhatsApp (wa.me) para un número ecuatoriano + mensaje
export function whatsappLink(number, text) {
  let n = (number || '').replace(/\D/g, '')
  if (n.startsWith('593')) {
    // ya tiene código de país
  } else if (n.startsWith('0')) {
    n = '593' + n.slice(1)
  } else if (n.length === 9) {
    n = '593' + n
  }
  return `https://wa.me/${n}?text=${encodeURIComponent(text)}`
}

// Nombre de archivo seguro a partir del nombre del equipo
export function safeFilename(name) {
  return (name || 'equipo')
    .normalize('NFKD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
    .toLowerCase()
}
