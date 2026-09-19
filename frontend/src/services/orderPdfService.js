import jsPDF from 'jspdf'
import {
  displayOrderDate,
  getProductName,
  getPaymentSummary,
  getStatusBadge
} from './orderFormatting'

// Generación del PDF descargable de un pedido. Se mantiene separado de
// OrdersHistoryPage para poder seguir mejorando la plantilla sin
// agregar más líneas a esa página.
//
// No se usa una imagen rasterizada del logo (evita tener que cargarla
// de forma asíncrona antes de generar el PDF); en su lugar se dibuja
// un monograma "AG" con los colores de marca directamente con jsPDF.

const BRAND_BLACK = [17, 17, 17]
const BRAND_GOLD = [255, 198, 3]
const TEXT_DARK = [26, 26, 26]
const TEXT_MUTED = [107, 114, 128]
const LIGHT_GOLD_BG = [253, 246, 220]
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
  red: { bg: [220, 38, 38], text: [255, 255, 255] }
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

export function generateOrderPdf(order) {
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
    author: 'Arte Grafía'
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
    const rowHeight = 10.5
    const boxHeight = Math.ceil(rows.length / 2) * rowHeight + 6

    ensureSpace(boxHeight)

    docPDF.setFillColor(...LIGHT_GOLD_BG)
    docPDF.setDrawColor(...LIGHT_GOLD_BORDER)
    docPDF.roundedRect(marginX, y, contentWidth, boxHeight, 2, 2, 'FD')

    const colWidth = contentWidth / 2
    let rowY = y + 7

    rows.forEach(([label, value], index) => {
      const col = index % 2
      const colX = marginX + 6 + col * colWidth

      if (col === 0 && index > 0) rowY += rowHeight

      docPDF.setFont('helvetica', 'normal')
      docPDF.setFontSize(8)
      docPDF.setTextColor(...TEXT_MUTED)
      docPDF.text(label.toUpperCase(), colX, rowY)

      docPDF.setFont('helvetica', 'bold')
      docPDF.setFontSize(10)
      docPDF.setTextColor(...TEXT_DARK)
      docPDF.text(String(value), colX, rowY + 4.6)
    })

    y += boxHeight + 8
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
  docPDF.rect(0, 0, pageWidth, 32, 'F')

  docPDF.setFillColor(...BRAND_GOLD)
  docPDF.circle(marginX + 7, 16, 7, 'F')
  docPDF.setTextColor(...BRAND_BLACK)
  docPDF.setFont('helvetica', 'bold')
  docPDF.setFontSize(11)
  docPDF.text('AG', marginX + 7, 18.5, { align: 'center' })

  docPDF.setTextColor(255, 255, 255)
  docPDF.setFont('helvetica', 'bold')
  docPDF.setFontSize(15)
  docPDF.text('Arte Grafía', marginX + 18, 14)

  docPDF.setTextColor(...BRAND_GOLD)
  docPDF.setFont('helvetica', 'normal')
  docPDF.setFontSize(10)
  docPDF.text('Cotización de pedido personalizado', marginX + 18, 21)

  docPDF.setTextColor(215, 215, 215)
  docPDF.setFontSize(8.5)
  docPDF.text(
    `Generado: ${new Date().toLocaleDateString('es-GT')}`,
    pageWidth - marginX,
    13,
    { align: 'right' }
  )

  if (order.id) {
    docPDF.text(
      `Folio: ${order.id.slice(0, 10)}`,
      pageWidth - marginX,
      19,
      { align: 'right' }
    )
  }

  y = 42

  // =========================
  // DATOS DEL PEDIDO
  // =========================

  heading('Datos del pedido')

  infoBox([
    ['Cliente', order.customerName || 'No definido'],
    ['Teléfono', order.phone || 'No definido'],
    ['Prenda', getProductName(order)],
    ['Talla', order.size || 'No definida'],
    ['Cantidad', order.quantity || 0],
    ['Técnica', order.technique || 'No definida'],
    ['Fecha del pedido', displayOrderDate(order.orderDate || order.createdAt)],
    ['Entrega prevista', displayOrderDate(order.expectedDeliveryDate)]
  ])

  if (order.deliveredAt) {
    lineItem('Primera entrega real:', displayOrderDate(order.deliveredAt))
    y += 2
  }

  // =========================
  // COTIZACIÓN
  // =========================

  heading('Cotización')

  lineItem(
    'Precio base de la prenda',
    `Q${Number(order.unitBasePrice || 0).toFixed(2)}`
  )

  if (order.personalizationSizeBack) {
    lineItem(
      `Recargo personalización - frente (${order.personalizationSize || 'chico'})`,
      `Q${Number(
        order.personalizationSurchargeFront ?? order.personalizationSurcharge ?? 0
      ).toFixed(2)}`
    )

    lineItem(
      `Recargo personalización - espalda (${order.personalizationSizeBack})`,
      `Q${Number(order.personalizationSurchargeBack || 0).toFixed(2)}`
    )
  } else {
    lineItem(
      `Recargo personalización (${order.personalizationSize || 'chico'})`,
      `Q${Number(order.personalizationSurcharge || 0).toFixed(2)}`
    )
  }

  lineItem(
    `Precio unitario  x  Cantidad (${order.quantity || 0})`,
    `Q${Number(order.quotedUnitPrice || 0).toFixed(2)}`
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
    { align: 'right' }
  )
  y += 20

  // =========================
  // FORMA DE PAGO
  // =========================

  heading('Forma de pago')

  infoBox([
    ['Plan', order.paymentPlan === 'completo' ? 'Pago completo' : 'Anticipo 50%'],
    ['Anticipo / pago inicial', `Q${payment.initial.toFixed(2)}`],
    ['Pago final', `Q${payment.final.toFixed(2)}`],
    ['Total pagado', `Q${payment.paid.toFixed(2)}`],
    ['Saldo pendiente', `Q${payment.balance.toFixed(2)}`]
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
    y + 5
  )
  y += 16

  // =========================
  // VALIDACIÓN IA
  // =========================

  heading('Validación del asistente inteligente')

  const aiValidation = order.aiValidation

  if (aiValidation) {
    lineItem('Nivel de riesgo:', aiValidation.riskLevel || 'No definido')
    lineItem(
      'Compatibilidad técnica:',
      aiValidation.techniqueCompatibility || 'No disponible'
    )

    y += 1
    paragraph(`Recomendación: ${aiValidation.recommendation || 'No disponible'}`)
    paragraph(`Nota para producción: ${aiValidation.productionNote || 'No disponible'}`)

    const warnings =
      Array.isArray(aiValidation.warnings) && aiValidation.warnings.length > 0
        ? aiValidation.warnings.map((warning) => `• ${warning}`).join('\n')
        : 'Sin advertencias registradas.'

    paragraph(`Advertencias:\n${warnings}`)

    if (order.aiValidatedAt) {
      paragraph(
        `Fecha de validación: ${new Date(order.aiValidatedAt).toLocaleString('es-GT')}`,
        { fontSize: 9, spacing: 5 }
      )
    }
  } else {
    paragraph('Este pedido no tiene una validación almacenada.')
  }

  y += 4

  // =========================
  // VISTA PREVIA
  // =========================

  if (order.previewBase64) {
    ensureSpace(100)
    heading('Vista previa')

    docPDF.setDrawColor(...LIGHT_GOLD_BORDER)
    docPDF.rect(marginX, y, 80, 95)
    docPDF.addImage(order.previewBase64, 'PNG', marginX, y, 80, 95)
    y += 100
  } else {
    heading('Vista previa')
    paragraph('Vista previa no disponible para este pedido.')
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
      contentWidth - 10
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
      { align: 'right' }
    )
  }

  const safeName = (order.customerName || 'cliente')
    .trim()
    .replace(/[^\p{L}\p{N}\s-]/gu, '')
    .replace(/\s+/g, '-') || 'cliente'

  docPDF.save(`cotizacion-${safeName}.pdf`)
}