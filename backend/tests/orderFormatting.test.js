import { describe, it, expect } from 'vitest'
import { getPaymentSummary, localDateValue, displayOrderDate, getProductName, getStatusBadge } from '../../frontend/src/services/orderFormatting.js'

describe('Cálculo de pagos y formato de pedidos', () => {
  it('PU-22 pedido sin pagos queda "Pendiente de pago"', () => {
    const r = getPaymentSummary({ quoteTotal: 500 })
    expect(r.status).toBe('pendiente_pago'); expect(r.balance).toBe(500)
  })
  it('PU-23 anticipo del 50 % deja pago parcial y saldo correcto', () => {
    const r = getPaymentSummary({ quoteTotal: 500, depositPaid: 250 })
    expect(r.status).toBe('pago_parcial'); expect(r.balance).toBe(250)
  })
  it('PU-24 anticipo más pago final deja el pedido "Pagado"', () => {
    const r = getPaymentSummary({ quoteTotal: 487.5, depositPaid: 243.75, finalPaymentPaid: 243.75 })
    expect(r.status).toBe('pagado'); expect(r.balance).toBe(0)
  })
  it('PU-25 decimales no generan errores de redondeo (0.1 + 0.2)', () => {
    const r = getPaymentSummary({ quoteTotal: 0.3, depositPaid: 0.1, finalPaymentPaid: 0.2 })
    expect(r.balance).toBe(0)
  })
  it('PU-26 montos negativos o inválidos se tratan como cero', () => {
    const r = getPaymentSummary({ quoteTotal: 100, depositPaid: -50, finalPaymentPaid: 'x' })
    expect(r.paid).toBe(0)
  })
  it('PU-27 fecha inexistente (2026-02-30) se rechaza', () => {
    expect(localDateValue('2026-02-30')).toBe('')
  })
  it('PU-28 fecha válida se muestra en formato dd/mm/aaaa', () => {
    expect(displayOrderDate('2026-10-09')).toBe('09/10/2026')
  })
  it('PU-29 pedido sin nombre de prenda muestra texto por defecto', () => {
    expect(getProductName({})).toBe('Prenda sin nombre registrado')
  })
  it('PU-30 estado desconocido muestra "Pendiente de aprobación"', () => {
    expect(getStatusBadge('xyz').label).toBe('Pendiente de aprobación')
  })
})
