import logoUrl from '../assets/brand/arte-grafia-logo.png'
import { categoryOf, CATEGORIES, AREA_LABELS } from './businessModel'
import jsPDF from 'jspdf'
import {
  displayOrderDate,
  getProductName,
  getPaymentSummary,
  getStatusBadge,
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

// Mismos colores que styles/statusBadges.css, para que el estado se
// vea igual en el PDF que en el historial.
const STATUS_PDF_COLORS = {
  amber: { bg: [255, 244, 204], text: [122, 94, 0] },
  gold: { bg: [255, 198, 3], text: [26, 26, 26] },
  black: { bg: [0, 0, 0], text: [255, 198, 3] },
  outline: { bg: [255, 255, 255], text: [26, 26, 26] },
  slate: { bg: [75, 85, 99], text: [255, 255, 255] },
  green: { bg: [22, 163, 74], text: [255, 255, 255] },
  red: { bg: [220, 38, 38], text: [255, 255, 255] },
}

const getStatusPdfColors = (status) => {
  const className = getStatusBadge(status).className
  const key = className.split(' ')[1]?.replace('status-badge-', '')
  return STATUS_PDF_COLORS[key] || STATUS_PDF_COLORS.amber
}

// bg-success / bg-warning text-dark / bg-secondary → mismos colores
// que el badge de "Situación de pago" del historial.
const getPaymentPdfColors = (badge) => {
  if (badge?.includes('success')) return STATUS_PDF_COLORS.green
  if (badge?.includes('warning')) return STATUS_PDF_COLORS.amber
  return { bg: [229, 231, 235], text: [55, 65, 81] }
}

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
  const garment = categoryOf(order) === 'prenda'
  const brandLogo = await loadImageAsDataUrl(logoUrl)
  const referenceImages = await Promise.all(
    (order.referenceImages || [])
      .filter((src) => src !== order.previewImage)
      .map(loadImageAsDataUrl),
  )
  // Se resuelve ANTES de dibujar nada: si la imagen no carga (sin
  // conexión, CORS del bucket, etc.) el PDF sigue generándose igual,
  // solo que sin la vista previa.
  let previewImageData = null

  if (order.previewImage)
    previewImageData = await loadImageAsDataUrl(order.previewImage)

  const docPDF = new jsPDF()
  const pageWidth = docPDF.internal.pageSize.getWidth()
  const pageHeight = docPDF.internal.pageSize.getHeight()
  const marginX = 16
  const contentWidth = pageWidth - marginX * 2
  const bottomLimit = pageHeight - 22

  const payment = getPaymentSummary(order)

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
    ensureSpace(14)
    docPDF.setTextColor(...TEXT_DARK)
    docPDF.setFont('helvetica', 'bold')
    docPDF.setFontSize(13)
    docPDF.text(text, marginX, y)
    docPDF.setDrawColor(...BRAND_GOLD)
    docPDF.setLineWidth(0.8)
    docPDF.line(marginX, y + 2, marginX + 26, y + 2)
    docPDF.setLineWidth(0.2)
    y += 9
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

  // Fila "etiqueta ......... monto", con el monto alineado a la derecha.
  const lineItem = (label, value, options = {}) => {
    const { bold = false, fontSize = 10.5 } = options

    ensureSpace(6.4)
    docPDF.setFont('helvetica', bold ? 'bold' : 'normal')
    docPDF.setFontSize(fontSize)
    docPDF.setTextColor(...TEXT_DARK)
    docPDF.text(label, marginX, y)
    docPDF.text(value, marginX + contentWidth, y, { align: 'right' })
    y += 6.4
  }

  // Caja clara con pares clave/valor en dos columnas (datos del
  // pedido, forma de pago, etc.).
  const infoBox = (rows) => {
    for (const [label, value] of rows)
      paragraph(`${label}: ${value}`, { fontSize: 10 })
    y += 3
  }

  const pill = (label, colors, x, pillY) => {
    docPDF.setFont('helvetica', 'bold')
    docPDF.setFontSize(9)
    const textWidth = docPDF.getTextWidth(label)
    const pillWidth = textWidth + 8

    docPDF.setFillColor(...colors.bg)
    docPDF.roundedRect(x, pillY - 5, pillWidth, 7, 3.5, 3.5, 'F')
    docPDF.setTextColor(...colors.text)
    docPDF.text(label, x + 4, pillY)

    return pillWidth
  }

  // =========================
  // ENCABEZADO DE MARCA
  // =========================

  docPDF.setFillColor(...BRAND_BLACK)
  docPDF.rect(0, 0, pageWidth, 60, 'F')
  docPDF.addImage(brandLogo.dataUrl, 'PNG', marginX, 8, 27, 27)
  docPDF.setTextColor(...BRAND_GOLD)
  docPDF.setFont('helvetica', 'bold')
  docPDF.setFontSize(20)
  docPDF.text('Arte Grafía', marginX + 34, 16)
  docPDF.setTextColor(255, 255, 255)
  docPDF.setFont('helvetica', 'normal')
  docPDF.setFontSize(10)
  docPDF.text('Cotización de pedido', marginX + 34, 23)
  docPDF.text('Teléfono: 5425-3023', marginX + 34, 30)
  docPDF.setFillColor(...BRAND_GOLD)
  docPDF.roundedRect(marginX + 34, 34, 5, 5, 1, 1, 'F')
  docPDF.setTextColor(...BRAND_BLACK)
  docPDF.setFont('helvetica', 'bold')
  docPDF.setFontSize(13)
  docPDF.text('f', marginX + 35.8, 38.4)
  docPDF.setTextColor(255, 255, 255)
  docPDF.setFont('helvetica', 'normal')
  docPDF.setFontSize(9)
  docPDF.text('Facebook: ArteGrafía', marginX + 42, 38)
  docPDF.setDrawColor(...BRAND_GOLD)
  docPDF.setLineWidth(0.5)
  docPDF.roundedRect(marginX + 100, 34, 5, 5, 1.3, 1.3, 'S')
  docPDF.circle(marginX + 102.5, 36.5, 1.2, 'S')
  docPDF.circle(marginX + 104, 35, 0.3, 'F')
  docPDF.setTextColor(255, 255, 255)
  docPDF.text('Instagram: ArteGrafía', marginX + 108, 38)
  docPDF.setFontSize(8)
  docPDF.text(
    'Avenida Chipilapa 3-69, zona 2, Barrio La Esperanza,',
    marginX,
    48,
  )
  docPDF.text('Jalapa, Guatemala', marginX, 53)
  y = 69
  paragraph(
    `Folio: ${order.id || 'Sin asignar'} | Generado: ${new Date().toLocaleDateString('es-GT')}`,
    { fontSize: 9 },
  )

  // =========================
  // DATOS DEL PEDIDO
  // =========================

  heading('Datos del pedido')

  infoBox([
    ['Cliente', order.customerName || 'No definido'],
    ['Teléfono', order.phone || 'No definido'],
    [CATEGORIES[categoryOf(order)], getProductName(order)],
    ['Talla', garment ? order.size || 'No registrada' : 'No aplica'],
    ['Cantidad', order.quantity || 0],
    ['Técnica', garment ? order.technique || 'No registrada' : 'No aplica'],
    ['Fecha del pedido', displayOrderDate(order.orderDate || order.createdAt)],
    ['Entrega prevista', displayOrderDate(order.expectedDeliveryDate)],
  ])

  if (order.deliveredAt) {
    lineItem('Primera entrega real:', displayOrderDate(order.deliveredAt))
    y += 2
  }

  // =========================
  // COTIZACIÓN
  // =========================

  if (order.description) paragraph(`Descripción: ${order.description}`)
  heading('Cotización')

  lineItem(
    categoryOf(order) === 'publicidad'
      ? 'Monto del trabajo'
      : 'Precio base unitario',
    `Q${Number(order.unitBasePrice || 0).toFixed(2)}`,
  )

  if (garment) {
    if (order.areaDetails && Object.keys(order.areaDetails).length) {
      for (const [area, detail] of Object.entries(order.areaDetails)) {
        paragraph(`${AREA_LABELS[area] || area}: ${detail.size}`, {
          fontSize: 10,
        })
        lineItem(
          'Recargo por unidad',
          `Q${Number(detail.surcharge || 0).toFixed(2)}`,
        )
      }
    } else {
      paragraph(
        `Tamaño de personalización: ${order.personalizationSize || 'No registrado'}`,
      )
      lineItem(
        'Recargo por personalización',
        `Q${Number(order.personalizationSurcharge || 0).toFixed(2)}`,
      )
    }
  } else if (order.personalizationSize)
    paragraph(`Tamaño o especificaciones: ${order.personalizationSize}`)

  lineItem(
    'Precio unitario',
    `Q${Number(order.quotedUnitPrice || 0).toFixed(2)}`,
  )

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
  ])

  ensureSpace(10)
  docPDF.setFont('helvetica', 'normal')
  docPDF.setFontSize(9.5)
  docPDF.setTextColor(...TEXT_MUTED)
  docPDF.text('Situación de pago:', marginX, y + 4)
  pill(payment.label, getPaymentPdfColors(payment.badge), marginX + 34, y + 5)
  y += 14

  // =========================
  // ESTADO DEL PEDIDO
  // =========================

  ensureSpace(10)
  docPDF.setFont('helvetica', 'normal')
  docPDF.setFontSize(9.5)
  docPDF.setTextColor(...TEXT_MUTED)
  docPDF.text('Estado del pedido:', marginX, y + 4)
  pill(
    getStatusBadge(order.status).label,
    getStatusPdfColors(order.status),
    marginX + 34,
    y + 5,
  )
  y += 16

  // =========================
  // VALIDACIÓN IA
  // =========================

  if (garment) {
    heading('Validación del asistente inteligente')

    const aiValidation = order.aiValidation

    if (aiValidation) {
      lineItem('Nivel de riesgo:', aiValidation.riskLevel || 'No definido')

      y += 1
      // "Compatibilidad técnica" puede ser una frase larga (no solo una
      // palabra corta como el nivel de riesgo): con lineItem() el texto
      // se dibuja alineado a la derecha sin salto de línea y se monta
      // encima de la etiqueta cuando es largo. paragraph() sí lo envuelve.
      paragraph(
        `Compatibilidad técnica: ${aiValidation.techniqueCompatibility || 'No disponible'}`,
      )

      y += 1
      paragraph(
        `Recomendación: ${aiValidation.recommendation || 'No disponible'}`,
      )
      paragraph(
        `Nota para producción: ${aiValidation.productionNote || 'No disponible'}`,
      )

      const warnings =
        Array.isArray(aiValidation.warnings) && aiValidation.warnings.length > 0
          ? aiValidation.warnings.map((warning) => `• ${warning}`).join('\n')
          : 'Sin advertencias registradas.'

      paragraph(`Advertencias:\n${warnings}`)

      if (order.aiValidatedAt) {
        paragraph(
          `Fecha de validación: ${new Date(order.aiValidatedAt).toLocaleString('es-GT')}`,
          { fontSize: 9, spacing: 5 },
        )
      }
    } else {
      paragraph('Este pedido no tiene una validación almacenada.')
    }

    y += 4
  }

  // =========================
  // VISTA PREVIA
  // =========================

  const allImages = [previewImageData, ...referenceImages].filter(Boolean)
  for (let index = 0; index < allImages.length; index++) {
    const image = allImages[index]
    const scale = Math.min(contentWidth / image.width, 155 / image.height)
    const width = image.width * scale,
      height = image.height * scale
    ensureSpace(height + 20)
    heading(index === 0 ? 'Vista previa' : `Imagen de referencia ${index}`)
    docPDF.addImage(
      image.dataUrl,
      'PNG',
      marginX + (contentWidth - width) / 2,
      y,
      width,
      height,
    )
    y += height + 8
  }

  // =========================
  // ANULACIÓN
  // =========================

  if (order.status === 'anulado') {
    y += 2
    ensureSpace(16)

    docPDF.setFillColor(253, 235, 235)
    docPDF.setDrawColor(243, 198, 198)
    const reasonText = order.cancelReason || 'No definido'
    const reasonLines = docPDF.splitTextToSize(
      `Motivo de anulación: ${reasonText}`,
      contentWidth - 10,
    )
    const boxHeight = reasonLines.length * 5.5 + 6
    docPDF.roundedRect(marginX, y, contentWidth, boxHeight, 2, 2, 'FD')

    docPDF.setFont('helvetica', 'normal')
    docPDF.setFontSize(10)
    docPDF.setTextColor(185, 28, 28)

    let reasonY = y + 6
    reasonLines.forEach((line) => {
      docPDF.text(line, marginX + 5, reasonY)
      reasonY += 5.5
    })

    y += boxHeight + 4
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
