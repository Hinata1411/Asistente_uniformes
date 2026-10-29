export const CATEGORIES = {
  prenda: 'Prenda',
  producto: 'Producto',
  publicidad: 'Publicidad',
}
export const categoryOf = (record) => record.category || 'prenda'
export const AREA_OPTIONS = [
  ['frente', 'Frente'],
  ['espalda', 'Espalda'],
  ['ambos', 'Frente y espalda'],
  ['manga_izquierda', 'Manga izquierda'],
  ['manga_derecha', 'Manga derecha'],
  ['mangas', 'Ambas mangas'],
]
export const AREA_LABELS = Object.fromEntries(AREA_OPTIONS)
export const areaKeys = (area) =>
  area === 'ambos'
    ? ['frente', 'espalda']
    : area === 'mangas'
      ? ['manga_izquierda', 'manga_derecha']
      : AREA_LABELS[area]
        ? [area]
        : []
export const imageKey = (area) =>
  ({
    frente: 'front',
    espalda: 'back',
    manga_izquierda: 'leftSleeve',
    manga_derecha: 'rightSleeve',
  })[area]
export const money = (value) =>
  Math.round((Number(value) + Number.EPSILON) * 100) / 100
export const validAmount = (value) =>
  value !== '' &&
  value != null &&
  Number.isFinite(Number(value)) &&
  Number(value) >= 0
export const today = () => {
  const d = new Date()
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`
}
export const monthStart = () => today().slice(0, 8) + '01'
export const safeCatalogUrl = (value) => {
  try {
    const u = new URL(value)
    return ['https:', 'http:'].includes(u.protocol) &&
      !u.username &&
      !u.password
      ? u.href
      : null
  } catch {
    return null
  }
}
export function financialTotals(orders, expenses, from, to, mode = 'quoted') {
  const inRange = (date) => (!from || date >= from) && (!to || date <= to)
  const income = orders
    .filter(
      (o) =>
        o.status !== 'anulado' &&
        inRange(o.orderDate || String(o.createdAt || '').slice(0, 10)),
    )
    .reduce(
      (sum, o) =>
        sum +
        Math.round(
          Number(
            mode === 'paid'
              ? (o.totalPaid ??
                  Number(o.depositPaid || 0) + Number(o.finalPaymentPaid || 0))
              : o.quoteTotal || 0,
          ) * 100,
        ),
      0,
    )
  const spent = expenses
    .filter((e) => inRange(e.date))
    .reduce((sum, e) => sum + Math.round(Number(e.amount || 0) * 100), 0)
  return {
    income: income / 100,
    expenses: spent / 100,
    remainder: (income - spent) / 100,
  }
}
