import jsPDF from 'jspdf'
import {
  displayOrderDate,
  getProductName,
  getPaymentSummary,
  getStatusBadge
} from './OrderFormatting'

// Generación del PDF descargable de un pedido. Se separó de
// OrdersHistoryPage para poder mejorar la plantilla (logo, colores,
// diseño) más adelante sin agregar más líneas a esa página.
//
// Por ahora es un PDF de texto básico armado línea por línea con
// jsPDF; queda listo para reemplazarse por un diseño más elaborado
// (encabezado con marca, tablas, etc.) sin tocar el resto de la app.
export function generateOrderPdf(order) {
  const docPDF = new jsPDF()
  let y = 20
  const payment = getPaymentSummary(order)

  const addText = (text, options = {}) => {
    const {
      fontSize = 12,
      spacing = 7,
      maxWidth = 170
    } = options

    docPDF.setFontSize(fontSize)

    const lines = docPDF.splitTextToSize(
      String(text),
      maxWidth
    )

    for (const line of lines) {
      if (y + spacing > docPDF.internal.pageSize.getHeight() - 20) {
        docPDF.addPage()
        y = 20
      }
      docPDF.text(line, 20, y)
      y += spacing
    }
  }

  const addDivider = () => {
    if (y + 4 > docPDF.internal.pageSize.getHeight() - 20) {
      docPDF.addPage()
      y = 20
    }
    docPDF.setDrawColor(220, 220, 220)
    docPDF.line(20, y, 190, y)
    y += 6
  }

  // ENCABEZADO
  addText('Pedido personalizado', {
    fontSize: 18,
    spacing: 9
  })

  y += 8

  // DATOS DEL PEDIDO
  addText(
    `Cliente: ${order.customerName || 'No definido'}`
  )

  addText(
    `Teléfono: ${order.phone || 'No definido'}`
  )

  addText(`Prenda: ${getProductName(order)}`)
  addText(`Fecha del pedido: ${displayOrderDate(order.orderDate || order.createdAt)}`)
  addText(`Entrega prevista: ${displayOrderDate(order.expectedDeliveryDate)}`)
  addText(`Primera entrega real: ${displayOrderDate(order.deliveredAt)}`)

  addText(
    `Talla: ${order.size || 'No definida'}`
  )

  addText(
    `Cantidad: ${order.quantity || 0}`
  )

  addText(
    `Técnica: ${order.technique || 'No definida'}`
  )

  y += 2
  addDivider()

  // COTIZACIÓN
  addText('Cotización', {
    fontSize: 14,
    spacing: 8
  })

  y += 1

  addText(
    `Precio base de la prenda ......... Q${Number(
      order.unitBasePrice || 0
    ).toFixed(2)}`
  )

  if (order.personalizationSizeBack) {
    addText(
      `Recargo personalización - frente (${
        order.personalizationSize || 'chico'
      }) ... Q${Number(
        order.personalizationSurchargeFront ??
          order.personalizationSurcharge ??
          0
      ).toFixed(2)}`
    )

    addText(
      `Recargo personalización - espalda (${
        order.personalizationSizeBack
      }) ... Q${Number(
        order.personalizationSurchargeBack || 0
      ).toFixed(2)}`
    )
  } else {
    addText(
      `Recargo personalización (${
        order.personalizationSize || 'chico'
      }) ......... Q${Number(
        order.personalizationSurcharge || 0
      ).toFixed(2)}`
    )
  }

  y += 1

  addText(
    `Precio unitario: Q${Number(
      order.quotedUnitPrice || 0
    ).toFixed(2)}   x   Cantidad: ${
      order.quantity || 0
    }`
  )

  addText(
    `TOTAL COTIZADO: Q${Number(
      order.quoteTotal || 0
    ).toFixed(2)}`,
    { fontSize: 13 }
  )

  y += 2
  addDivider()

  addText('Forma de pago', {
    fontSize: 13,
    spacing: 7
  })

  addText(`Plan: ${order.paymentPlan === 'completo' ? 'Pago completo' : 'Anticipo 50%'}`)
  addText(`Anticipo / pago inicial: Q${payment.initial.toFixed(2)}`)
  addText(`Pago final: Q${payment.final.toFixed(2)}`)
  addText(`Total pagado: Q${payment.paid.toFixed(2)}`)
  addText(`Saldo pendiente: Q${payment.balance.toFixed(2)}`)
  addText(`Situación de pago: ${payment.label}`)

  y += 2
  addDivider()

  addText(
    `Estado del pedido: ${getStatusBadge(order.status).label}`
  )

  y += 6

  // VALIDACIÓN IA
  addText('Validación del asistente inteligente:', {
    fontSize: 14,
    spacing: 8
  })

  const aiValidation = order.aiValidation

  if (aiValidation) {
    addText(
      `Nivel de riesgo: ${
        aiValidation.riskLevel || 'No definido'
      }`
    )

    addText(
      `Compatibilidad técnica: ${
        aiValidation.techniqueCompatibility ||
        'No disponible'
      }`
    )

    addText(
      `Recomendación: ${
        aiValidation.recommendation || 'No disponible'
      }`
    )

    addText(
      `Nota para producción: ${
        aiValidation.productionNote || 'No disponible'
      }`
    )

    const warnings =
      Array.isArray(aiValidation.warnings) &&
      aiValidation.warnings.length > 0
        ? aiValidation.warnings
            .map((warning) => `• ${warning}`)
            .join('\n')
        : 'Sin advertencias registradas.'

    addText(`Advertencias:\n${warnings}`)

    if (order.aiValidatedAt) {
      addText(
        `Fecha de validación: ${new Date(
          order.aiValidatedAt
        ).toLocaleString()}`
      )
    }
  } else {
    addText(
      'Este pedido no tiene una validación almacenada.'
    )
  }

  y += 6

  // VISTA PREVIA
  if (order.previewBase64) {
    if (y + 115 > docPDF.internal.pageSize.getHeight() - 20) {
      docPDF.addPage()
      y = 20
    }
    addText('Vista previa:')

    docPDF.addImage(
      order.previewBase64,
      'PNG',
      20,
      y,
      80,
      95
    )

    y += 105
  } else {
    addText(
      'Vista previa no disponible para este pedido.'
    )
  }

  // ANULACIÓN
  if (order.status === 'anulado') {
    y += 5

    addText(
      `Motivo de anulación: ${
        order.cancelReason || 'No definido'
      }`
    )
  }

  docPDF.save(
    `pedido-${order.customerName || 'cliente'}.pdf`
  )
}