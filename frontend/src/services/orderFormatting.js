// Utilidades de formato y cálculo compartidas por las vistas de pedidos
// (historial, PDF, mensaje de WhatsApp, etc.). Viven aparte para no
// repetir esta lógica en cada lugar que necesita mostrar o exportar
// un pedido.

export const localDateValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`)
    if (!Number.isFinite(parsed.getTime())) return ''
    const normalized = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    return normalized === value ? value : ''
  }
  try {
    const date = typeof value.toDate === 'function'
      ? value.toDate()
      : value.seconds != null
        ? new Date(value.seconds * 1000)
        : new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } catch { return '' }
}

export const displayOrderDate = (value) => {
  const date = localDateValue(value)
  return date ? date.split('-').reverse().join('/') : 'No registrada'
}

export const getProductName = (order) => {
  const candidates = [
    order.productName,
    typeof order.product === 'string'
      ? order.product
      : order.product?.name,
    order.productType
  ]

  const name = candidates.find(
    (value) =>
      typeof value === 'string' &&
      value.trim().length > 0
  )

  return name?.trim() || 'Prenda sin nombre registrado'
}

export const getPaymentSummary = (order) => {
  const cents = (value) => {
    const number = Number(value)
    return Number.isFinite(number) ? Math.max(0, Math.round(number * 100)) : 0
  }
  const total = cents(order.quoteTotal)
  const initial = cents(order.depositPaid)
  const final = cents(order.finalPaymentPaid)
  const paid = initial + final
  const balance = Math.max(0, total - paid)
  let status = 'pendiente_pago'
  let label = 'Pendiente de pago'
  let badge = 'bg-secondary'

  if (balance === 0) {
    status = 'pagado'
    label = 'Pagado'
    badge = 'bg-success'
  } else if (paid > 0) {
    status = 'pago_parcial'
    label = 'Pago parcial'
    badge = 'bg-warning text-dark'
  }

  return {
    total: total / 100,
    initial: initial / 100,
    final: final / 100,
    paid: paid / 100,
    balance: balance / 100,
    status, label, badge
  }
}

// Un color y una etiqueta clara por cada estado real del pedido,
// siempre dentro de la paleta de marca (negro/dorado), salvo
// entregado (éxito) y anulado (riesgo), que deben distinguirse
// de inmediato por convención.
export const STATUS_BADGE_META = {
  pendiente_aprobacion: {
    label: 'Pendiente de aprobación',
    className: 'status-badge status-badge-amber'
  },
  aprobado: {
    label: 'Aprobado',
    className: 'status-badge status-badge-gold'
  },
  en_produccion: {
    label: 'En producción',
    className: 'status-badge status-badge-black'
  },
  en_arreglo: {
    label: 'En arreglo / devolución',
    className: 'status-badge status-badge-outline'
  },
  terminado: {
    label: 'Terminado',
    className: 'status-badge status-badge-slate'
  },
  entregado: {
    label: 'Entregado',
    className: 'status-badge status-badge-green'
  },
  anulado: {
    label: 'Anulado',
    className: 'status-badge status-badge-red'
  }
}

export const getStatusBadge = (status) =>
  STATUS_BADGE_META[status] || STATUS_BADGE_META.pendiente_aprobacion