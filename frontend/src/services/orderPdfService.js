import logoUrl from '../assets/brand/arte-grafia-logo.png'
import { categoryOf, CATEGORIES, AREA_LABELS } from './businessModel'
import jsPDF from 'jspdf'
import {
  displayOrderDate,
  getProductName,
  getPaymentSummary,
} from './orderFormatting'

// Generación del PDF descargable de un pedido. Se mantiene separado de
// OrdersHistoryPage para poder seguir mejorando la plantilla sin
// agregar más líneas a esa página.
//
// El logo oficial se carga antes de generar el documento.

const BRAND_BLACK = [17, 17, 17]
const BRAND_GOLD = [255, 198, 3]
const TEXT_DARK = [26, 26, 26]
const TEXT_MUTED = [107, 114, 128]
const LIGHT_GOLD_BORDER = [240, 226, 171]
const LIGHT_GOLD_BG = [253, 246, 220]
const SOFT_BG = [249, 248, 245]
const GOLD_INK = [105, 72, 0]

/*
  Convierte la vista previa (una URL de Firebase Storage) en un data
  URL usando un <canvas>, que es lo que jsPDF necesita para poder
  incrustar la imagen. jsPDF no puede descargar la imagen por sí
  mismo: si se le pasa la URL remota tal cual, simplemente no la
  dibuja.

  Devuelve también el ancho/alto reales de la imagen para poder
  encajarla en el recuadro del PDF sin deformarla.
*/
function loadImageAsDataUrl(url) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'

    img.onload = () => {
      try {
        const canvas = document.createElement('canvas')
        canvas.width = img.naturalWidth
        canvas.height = img.naturalHeight

        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0)

        resolve({
          dataUrl: canvas.toDataURL('image/png'),
          width: img.naturalWidth,
          height: img.naturalHeight,
        })
      } catch (error) {
        reject(error)
      }
    }

    img.onerror = () => {
      reject(new Error('No se pudo cargar la vista previa del pedido.'))
    }

    img.src = url
  })
}

export async function generateOrderPdf(order, { download = true } = {}) {
  const category = categoryOf(order)
  const garment = category === 'prenda'
  const customerGarment = garment && (order.garmentSource === 'customer' ||
    (!order.garmentSource && (order.customerGarment || order.customerGarmentImage)))
  const images = [
    { label: 'Vista previa de la personalización', src: order.previewImage },
    ...(Array.isArray(order.referenceImages) ? order.referenceImages : [])
      .filter(Boolean)
      .filter((src, index, list) => src !== order.previewImage && list.indexOf(src) === index)
      .map((src, index) => ({ label: 'Imagen de referencia ' + (index + 1), src })),
  ].filter(({ src }) => src)
  const tryImage = (src) => loadImageAsDataUrl(src).catch(() => null)
  const [brandLogo, ...loadedImages] = await Promise.all([
    tryImage(logoUrl),
    ...images.map(({ src }) => tryImage(src)),
  ])

  const docPDF = new jsPDF()
  const pageWidth = docPDF.internal.pageSize.getWidth()
  const pageHeight = docPDF.internal.pageSize.getHeight()
  const marginX = 16
  const contentWidth = pageWidth - marginX * 2
  const bottomLimit = pageHeight - 22

  const payment = getPaymentSummary(order)
  const formatMoney = (value) => 'Q' + (Number(value) || 0).toFixed(2)

  let y = 0

  docPDF.setProperties({
    title: `Cotización - ${order.customerName || 'cliente'}`,
    author: 'Arte Grafía',
  })

  const ensureSpace = (needed) => {
    if (y + needed > bottomLimit) {
      docPDF.addPage()
      y = 22
    }
  }

  const heading = (text) => {
    ensureSpace(23)
    docPDF.setFillColor(...BRAND_GOLD)
    docPDF.roundedRect(marginX, y - 4.2, 2.3, 6, 0.7, 0.7, 'F')
    docPDF.setTextColor(...TEXT_DARK)
    docPDF.setFont('helvetica', 'bold')
    docPDF.setFontSize(13)
    docPDF.text(text, marginX + 5, y)

    const labelEnd = marginX + 8 + docPDF.getTextWidth(text)
    docPDF.setDrawColor(...LIGHT_GOLD_BORDER)
    docPDF.setLineWidth(0.35)
    if (labelEnd < marginX + contentWidth)
      docPDF.line(labelEnd, y - 1.2, marginX + contentWidth, y - 1.2)
    y += 7
  }

  const paragraph = (text, options = {}) => {
    const { fontSize = 10.5, spacing = 5.6, bold = false } = options

    docPDF.setFont('helvetica', bold ? 'bold' : 'normal')
    docPDF.setFontSize(fontSize)
    docPDF.setTextColor(...TEXT_DARK)

    const lines = docPDF.splitTextToSize(String(text), contentWidth)

    for (const line of lines) {
      ensureSpace(spacing)
      docPDF.text(line, marginX, y)
      y += spacing
    }
  }

  const lineItem = (label, value) => {
    ensureSpace(8.5)
    docPDF.setFillColor(...SOFT_BG)
    docPDF.roundedRect(marginX, y - 4, contentWidth, 7, 1, 1, 'F')
    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(10.5)
    docPDF.setTextColor(...TEXT_DARK)
    docPDF.text(label, marginX + 4, y + 0.6)
    docPDF.setFont('helvetica', 'bold')
    docPDF.text(value, marginX + contentWidth - 4, y + 0.6, { align: 'right' })
    y += 8.5
  }

  const infoBox = (rows, { highlight = '', fill = LIGHT_GOLD_BG } = {}) => {
    const colWidth = contentWidth / 2
    const pairs = []
    docPDF.setFont('helvetica', 'bold')
    docPDF.setFontSize(10)
    for (let index = 0; index < rows.length; index += 2) {
      const cells = rows.slice(index, index + 2).map(([label, value]) => ({
        label,
        lines: docPDF.splitTextToSize(String(value), colWidth - 12),
      }))
      pairs.push({ cells, height: 8 + Math.max(...cells.map(cell => cell.lines.length)) * 4.3 })
    }
    let index = 0
    while (index < pairs.length) {
      const pair = pairs[index]
      if (pair.height > bottomLimit - 32) {
        for (const { label, lines } of pair.cells) paragraph(label + ': ' + lines.join(' '))
        index++
        continue
      }
      ensureSpace(pair.height + 7)
      let height = 6
      let end = index
      while (end < pairs.length && y + height + pairs[end].height <= bottomLimit) {
        height += pairs[end].height
        end++
      }
      docPDF.setFillColor(...fill)
      docPDF.setDrawColor(...LIGHT_GOLD_BORDER)
      docPDF.setLineWidth(0.35)
      docPDF.roundedRect(marginX, y - 3, contentWidth, height, 2, 2, 'FD')
      let rowY = y
      for (; index < end; index++) {
        const { cells, height: rowHeight } = pairs[index]
        cells.forEach(({ label, lines }, col) => {
          const x = marginX + col * colWidth
          if (label === highlight) {
            docPDF.setFillColor(...LIGHT_GOLD_BG)
            docPDF.roundedRect(x + 2, rowY, colWidth - 4, rowHeight, 1.3, 1.3, 'F')
          }
          docPDF.setFont('helvetica', 'bold')
          docPDF.setFontSize(8)
          docPDF.setTextColor(...GOLD_INK)
          docPDF.text(label.toUpperCase(), x + 6, rowY + 4)
          docPDF.setFontSize(10)
          docPDF.setTextColor(...TEXT_DARK)
          lines.forEach((line, lineIndex) => docPDF.text(line, x + 6, rowY + 8.5 + 4.3 * lineIndex))
        })
        rowY += rowHeight
      }
      y += height + 4
    }
  }

  const detailBox = (label, value) => {
    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(10.5)
    const lines = docPDF.splitTextToSize(value, contentWidth - 14)
    let index = 0
    while (index < lines.length) {
      ensureSpace(21)
      const count = Math.min(lines.length - index, Math.floor((bottomLimit - y - 13) / 5))
      const height = 13 + count * 5
      docPDF.setFillColor(...SOFT_BG)
      docPDF.setDrawColor(...LIGHT_GOLD_BORDER)
      docPDF.setLineWidth(0.35)
      docPDF.roundedRect(marginX, y - 3, contentWidth, height, 2, 2, 'FD')
      docPDF.setFont('helvetica', 'bold')
      docPDF.setTextColor(...GOLD_INK)
      docPDF.text(index ? label + ' (continuación)' : label, marginX + 6, y + 4)
      docPDF.setFont('helvetica', 'normal')
      docPDF.setTextColor(...TEXT_DARK)
      lines.slice(index, index + count).forEach((line, row) => {
        docPDF.text(line, marginX + 6, y + 10 + row * 5)
      })
      index += count
      y += height + 3
    }
  }

  // =========================
  // ENCABEZADO DE MARCA
  // =========================

  docPDF.setFillColor(...BRAND_BLACK)
  docPDF.rect(0, 0, pageWidth, 57, 'F')
  docPDF.setFillColor(...BRAND_GOLD)
  docPDF.rect(0, 57, pageWidth, 1.4, 'F')
  if (brandLogo) {
    const scale = Math.min(31 / brandLogo.width, 33 / brandLogo.height)
    const width = brandLogo.width * scale
    const height = brandLogo.height * scale
    docPDF.addImage(brandLogo.dataUrl, 'PNG', marginX + (31 - width) / 2,
      (57 - height) / 2, width, height)
  }
  const headerX = marginX + 41
  docPDF.setTextColor(...BRAND_GOLD)
  docPDF.setFont('helvetica', 'bold')
  docPDF.setFontSize(23)
  docPDF.text('Arte Grafía', headerX, 15)
  docPDF.setTextColor(255, 255, 255)
  docPDF.setFontSize(12)
  docPDF.text('Cotización de pedido', headerX, 22)
  docPDF.setFont('helvetica', 'normal')
  docPDF.setFontSize(9)
  docPDF.text('Avenida Chipilapa 3-69, zona 2, Barrio La Esperanza,', headerX, 31)
  docPDF.text('Jalapa, Jalapa, Guatemala', headerX, 35.5)

  const socialY = 42
  docPDF.setDrawColor(...BRAND_GOLD)
  docPDF.setFillColor(...BRAND_GOLD)
  docPDF.setLineWidth(0.45)
  docPDF.roundedRect(headerX, socialY, 5, 5, 1.1, 1.1, 'S')
  docPDF.circle(headerX + 2.5, socialY + 2.5, 1.15, 'S')
  docPDF.circle(headerX + 3.8, socialY + 1.2, 0.32, 'F')
  docPDF.text('@artegrafiauniformes', headerX + 7.5, socialY + 3.6)
  const facebookX = headerX + 49
  docPDF.roundedRect(facebookX, socialY, 5, 5, 0.8, 0.8, 'F')
  docPDF.setTextColor(...BRAND_BLACK)
  docPDF.setFont('helvetica', 'bold')
  docPDF.setFontSize(13)
  docPDF.text('f', facebookX + 1.7, socialY + 4.5)
  docPDF.setTextColor(255, 255, 255)
  docPDF.setFont('helvetica', 'normal')
  docPDF.setFontSize(9)
  docPDF.text('Arte Grafía', facebookX + 7.5, socialY + 3.6)
  docPDF.text('Tel. 5425-3023', headerX, 52)
  y = 70

  // =========================
  // DATOS DEL PEDIDO
  // =========================

  heading('Datos del pedido')

  infoBox([
    ['Cliente', order.customerName || 'No definido'],
    ['Teléfono', order.phone || 'No definido'],
    [CATEGORIES[category] || 'Artículo', getProductName(order, CATEGORIES[category])],
    ...(garment ? [['Talla', order.size || 'No registrada']] : []),
    ['Cantidad', order.quantity || 0],
    ...(garment ? [['Técnica', order.technique || 'No registrada']] : []),
    ['Fecha del pedido', displayOrderDate(order.orderDate || order.createdAt)],
    ['Entrega prevista', displayOrderDate(order.expectedDeliveryDate)],
  ])

  // =========================
  // COTIZACIÓN
  // =========================

  heading('Cotización')
  if (garment && !customerGarment) {
    lineItem('Precio base de la prenda por unidad', formatMoney(order.unitBasePrice))
  }
  if (category === 'publicidad') {
    lineItem('Monto del trabajo', formatMoney(order.unitBasePrice ?? order.quoteTotal))
  }

  if (garment) {
    const details = Object.entries(order.areaDetails || {})
    if (details.length) {
      for (const [area, detail] of details) {
        ensureSpace(14)
        paragraph(`Tamaño de personalización - ${AREA_LABELS[area] || area}: ${detail.size || 'No registrado'}`)
        if (!customerGarment) lineItem('Recargo por unidad', formatMoney(detail.surcharge))
      }
    } else if (order.personalizationSizeBack) {
      for (const [area, size, surcharge] of [
        ['Frente', order.personalizationSize, order.personalizationSurchargeFront ?? order.personalizationSurcharge],
        ['Espalda', order.personalizationSizeBack, order.personalizationSurchargeBack],
      ]) {
        ensureSpace(14)
        paragraph(`Tamaño de personalización - ${area}: ${size || 'No registrado'}`)
        if (!customerGarment) lineItem('Recargo por unidad', formatMoney(surcharge))
      }
    } else {
      if (order.personalizationSize) paragraph('Tamaño de personalización: ' + order.personalizationSize)
      if (!customerGarment) lineItem('Recargo por unidad', formatMoney(order.personalizationSurcharge))
    }
  }

  if (category !== 'publicidad') {
    const unitPrice = order.quotedUnitPrice ?? (order.quantity > 0 ? payment.total / order.quantity : payment.total)
    lineItem('Precio unitario', formatMoney(unitPrice))
  }

  y += 2
  ensureSpace(16)

  docPDF.setFillColor(...BRAND_BLACK)
  docPDF.roundedRect(marginX, y, contentWidth, 12, 2, 2, 'F')
  docPDF.setTextColor(...BRAND_GOLD)
  docPDF.setFont('helvetica', 'bold')
  docPDF.setFontSize(12)
  docPDF.text('TOTAL COTIZADO', marginX + 5, y + 8)
  docPDF.text(
    `Q${Number(order.quoteTotal || 0).toFixed(2)}`,
    marginX + contentWidth - 5,
    y + 8,
    { align: 'right' },
  )
  y += 20

  // =========================
  // FORMA DE PAGO
  // =========================

  heading('Forma de pago')
  lineItem(
    'Pago inicial previsto',
    `Q${Number(order.initialPaymentAmount ?? (order.paymentPlan === 'completo' ? order.quoteTotal : Number(order.quoteTotal || 0) * 0.5)).toFixed(2)}`,
  )

  infoBox([
    [
      'Plan',
      order.paymentPlan === 'completo' ? 'Pago completo' : 'Anticipo 50%',
    ],
    ['Anticipo / pago inicial', `Q${payment.initial.toFixed(2)}`],
    ['Pago final', `Q${payment.final.toFixed(2)}`],
    ['Total pagado', `Q${payment.paid.toFixed(2)}`],
    ['Saldo pendiente', `Q${payment.balance.toFixed(2)}`],
  ], { fill: SOFT_BG, highlight: 'Saldo pendiente' })

  const description = order.description?.trim() || order.customerGarment?.description?.trim()
  const specifications = garment ? '' : order.personalizationSize?.trim()
  if (description || specifications) {
    ensureSpace(28)
    heading('Detalles de personalización')
    if (description) detailBox('Descripción o comentario', description)
    if (specifications) detailBox('Tamaño o especificaciones', specifications)
  }

  for (let index = 0; index < images.length; index++) {
    const image = loadedImages[index]
    if (!image) {
      heading(images[index].label)
      paragraph('No se pudo cargar esta imagen.')
      continue
    }
    const naturalScale = Math.min(contentWidth / image.width, 145 / image.height)
    const naturalHeight = image.height * naturalScale
    ensureSpace(Math.min(72, naturalHeight) + 18)
    heading(images[index].label)
    const scale = Math.min(naturalScale, (bottomLimit - y - 5) / image.height)
    const width = image.width * scale
    const height = image.height * scale
    docPDF.setFillColor(...SOFT_BG)
    docPDF.setDrawColor(...LIGHT_GOLD_BORDER)
    docPDF.setLineWidth(0.35)
    docPDF.roundedRect(marginX, y - 2, contentWidth, height + 4, 2, 2, 'FD')
    docPDF.addImage(image.dataUrl, 'PNG', marginX + (contentWidth - width) / 2, y, width, height)
    y += height + 8
  }

  // =========================
  // PIE DE PÁGINA (todas las páginas)
  // OTRO COMENTARIO
  // =========================

  const totalPages = docPDF.internal.getNumberOfPages()

  for (let page = 1; page <= totalPages; page += 1) {
    docPDF.setPage(page)

    docPDF.setDrawColor(...LIGHT_GOLD_BORDER)
    docPDF.setLineWidth(0.4)
    docPDF.line(marginX, pageHeight - 14, pageWidth - marginX, pageHeight - 14)

    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(8)
    docPDF.setTextColor(...TEXT_MUTED)
    docPDF.text('Arte Grafía · Jalapa, Guatemala', marginX, pageHeight - 8)
    docPDF.text(
      `Página ${page} de ${totalPages}`,
      pageWidth - marginX,
      pageHeight - 8,
      { align: 'right' },
    )
  }

  const safeName =
    (order.customerName || 'cliente')
      .trim()
      .replace(/[^\p{L}\p{N}\s-]/gu, '')
      .replace(/\s+/g, '-') || 'cliente'

  if (download) docPDF.save(`cotizacion-${safeName}.pdf`)
  return docPDF
}
