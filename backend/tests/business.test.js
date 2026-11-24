import { describe, it, expect } from 'vitest'
import {
  financialTotals,
  areaKeys,
  safeCatalogUrl,
  categoryOf,
  money,
} from '../../frontend/src/services/businessModel.js'
import { applyOrderTransaction } from '../../frontend/src/services/orderTransaction.js'
import { validateBasicRules } from '../services/aiService.js'
const base = {
  category: 'prenda',
  garmentSource: 'inventory',
  productId: 'p',
  quantity: 2,
  size: 'Manual 42',
  quoteTotal: 200,
  paymentPlan: 'anticipo_50',
}
function fake(records) {
  const writes = []
  let hasWritten = false
  const tx = {
    get: async (ref) => {
      if (hasWritten) throw new Error('read after write')
      const data = records[ref]
      return { exists: () => Boolean(data), data: () => data, ref }
    },
    update: (ref, data) => {
      hasWritten = true
      writes.push({ ref, data })
    },
    set: (ref, data) => {
      hasWritten = true
      writes.push({ ref, data })
    },
  }
  return {
    writes,
    run: (data = base, id) =>
      applyOrderTransaction(tx, data, id, {
        db: {},
        doc: (_, type, id) => `${type}/${id}`,
        orderRef: 'orders/o',
      }),
  }
}
describe('categorías y finanzas', () => {
  it('mantiene prendas antiguas sin categoría', () =>
    expect(categoryOf({})).toBe('prenda'))
  it('mapea cada manga a su imagen sin confundirla con frente', () => {
    expect(areaKeys('mangas')).toEqual(['manga_izquierda', 'manga_derecha'])
    expect(areaKeys('manga_izquierda')).toEqual(['manga_izquierda'])
    expect(areaKeys('ambos')).toEqual(['frente', 'espalda'])
  })
  it.each(['manga_izquierda', 'manga_derecha', 'mangas'])(
    'la IA admite el área %s y talla manual',
    (side) =>
      expect(
        validateBasicRules({
          garmentSource: 'customer',
          product: 'Camisa',
          productType: 'camisa',
          size: '42 especial',
          technique: 'DTF',
          quantity: 1,
          customizationSide: side,
        }).hasBlockingError,
      ).toBe(false),
  )
  it('rechaza enlaces ejecutables y credenciales embebidas', () => {
    for (const url of [
      'javascript:alert(1)',
      'data:text/html,test',
      'https://user:pass@example.com',
    ])
      expect(safeCatalogUrl(url)).toBeNull()
    expect(safeCatalogUrl('https://example.com/catalogo')).toBe(
      'https://example.com/catalogo',
    )
  })
  it('filtra fechas inclusivas y excluye anulados', () => {
    const orders = [
        { orderDate: '2026-10-01', quoteTotal: 100, totalPaid: 50 },
        { orderDate: '2026-10-31', quoteTotal: 60, totalPaid: 0 },
        { orderDate: '2026-09-30', quoteTotal: 500 },
        { orderDate: '2026-10-15', quoteTotal: 80, status: 'anulado' },
      ],
      expenses = [
        { date: '2026-10-31', amount: 30 },
        { date: '2026-11-01', amount: 99 },
      ]
    expect(
      financialTotals(orders, expenses, '2026-10-01', '2026-10-31'),
    ).toEqual({ income: 160, expenses: 30, remainder: 130 })
    expect(
      financialTotals(orders, expenses, '2026-10-01', '2026-10-31', 'paid'),
    ).toEqual({ income: 50, expenses: 30, remainder: 20 })
  })
  it('mantiene centavos exactos y saldos negativos', () => {
    expect(money(10.125)).toBe(10.13)
    expect(
      financialTotals(
        [
          { orderDate: '2026-10-01', quoteTotal: 0.1 },
          { orderDate: '2026-10-01', quoteTotal: 0.2 },
        ],
        [{ date: '2026-10-01', amount: 1 }],
        '',
        '',
      ).remainder,
    ).toBe(-0.7)
  })
})
describe('transacción de pedidos', () => {
  const product = {
    category: 'prenda',
    size: 'Manual 42',
    stock: 5,
    active: true,
  }
  it('descuenta stock y guarda un pendiente sin pagos confirmados', async () => {
    const f = fake({ 'products/p': product })
    await f.run()
    expect(f.writes.find((w) => w.ref === 'products/p').data.stock).toBe(3)
    const order = f.writes.find((w) => w.ref === 'orders/o').data
    expect(order.status).toBe('pendiente_aprobacion')
    expect(order.depositPaid).toBe(0)
    expect(order.initialPaymentAmount).toBe(100)
    expect(order.balanceDue).toBe(200)
  })
  it('rechaza inventario insuficiente sin escribir', async () => {
    const f = fake({ 'products/p': { ...product, stock: 1 } })
    await expect(f.run()).rejects.toThrow('stock')
    expect(f.writes).toHaveLength(0)
  })
  it('al editar devuelve la reserva anterior antes de descontar la nueva', async () => {
    const f = fake({
      'products/p': { ...product, stock: 0 },
      'orders/o': {
        ...base,
        status: 'aprobado',
        depositPaid: 100,
        quantity: 2,
      },
    })
    await f.run({ ...base, quantity: 1, quoteTotal: 150 }, 'o')
    expect(f.writes.find((w) => w.ref === 'products/p').data.stock).toBe(1)
    const order = f.writes.find((w) => w.ref === 'orders/o').data
    expect(order.depositPaid).toBe(100)
    expect(order.balanceDue).toBe(50)
    expect(order).not.toHaveProperty('status')
  })
  it('cambia de producto devolviendo y descontando sin lecturas tardías', async () => {
    const f = fake({
      'products/p': product,
      'products/new': { ...product, stock: 10 },
      'orders/o': { ...base, status: 'pendiente_aprobacion' },
    })
    await f.run({ ...base, productId: 'new', quantity: 3 }, 'o')
    expect(f.writes.find((w) => w.ref === 'products/p').data.stock).toBe(7)
    expect(f.writes.find((w) => w.ref === 'products/new').data.stock).toBe(7)
  })
  it('al pasar a prenda del cliente devuelve inventario', async () => {
    const f = fake({
      'products/p': product,
      'orders/o': { ...base, status: 'pendiente_aprobacion' },
    })
    await f.run({ ...base, garmentSource: 'customer', productId: null }, 'o')
    expect(f.writes.find((w) => w.ref === 'products/p').data.stock).toBe(7)
  })
  it('publicidad no modifica inventario ni requiere talla o IA', async () => {
    const f = fake({})
    await f.run({
      ...base,
      category: 'publicidad',
      garmentSource: 'advertising',
      productId: null,
      size: '',
      quantity: 1,
      quoteTotal: 500,
    })
    expect(f.writes).toHaveLength(1)
    expect(f.writes[0].data.quoteTotal).toBe(500)
  })
  it('producto de inventario sin talla funciona', async () => {
    const f = fake({
      'products/p': { category: 'producto', stock: 4, active: true },
    })
    await f.run({ ...base, category: 'producto', size: '' })
    expect(f.writes.find((w) => w.ref === 'products/p').data.stock).toBe(2)
  })
  it('revalida categoría y talla contra el inventario actual', async () => {
    await expect(
      fake({ 'products/p': { ...product, category: 'producto' } }).run(),
    ).rejects.toThrow('categoría')
    await expect(
      fake({ 'products/p': { ...product, size: 'otra' } }).run(),
    ).rejects.toThrow('talla')
  })
  it('no reduce el total por debajo de lo cobrado', async () => {
    const f = fake({
      'products/p': product,
      'orders/o': { ...base, status: 'aprobado', depositPaid: 100 },
    })
    await expect(f.run({ ...base, quoteTotal: 90 }, 'o')).rejects.toThrow(
      'cobrado',
    )
    expect(f.writes).toHaveLength(0)
  })
  it('no edita pedidos anulados o eliminados', async () => {
    await expect(
      fake({ 'orders/o': { ...base, status: 'anulado' } }).run(base, 'o'),
    ).rejects.toThrow('anulado')
    await expect(fake({}).run(base, 'o')).rejects.toThrow('no existe')
  })
  it('bloquea cambiar el total de una entrega', async () => {
    await expect(
      fake({
        'products/p': product,
        'orders/o': {
          ...base,
          status: 'entregado',
          depositPaid: 100,
          finalPaymentPaid: 100,
        },
      }).run({ ...base, quoteTotal: 250 }, 'o'),
    ).rejects.toThrow('Reabre')
  })
  it('impide reutilizar inventario antiguo con varias tallas', async () => {
    await expect(
      fake({ 'products/p': { stock: 10, sizes: ['M', 'L'] } }).run(),
    ).rejects.toThrow('antiguo')
  })
  it.each([0, -1, 1.5])(
    'rechaza cantidad %s antes de escribir',
    async (quantity) => {
      const f = fake({})
      await expect(f.run({ ...base, quantity })).rejects.toThrow('inválidos')
      expect(f.writes).toHaveLength(0)
    },
  )
})
