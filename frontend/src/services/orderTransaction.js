import { money, categoryOf } from './businessModel.js'
export async function applyOrderTransaction(
  tx,
  data,
  editingId,
  { db, doc, orderRef },
) {
  if (
    !['prenda', 'producto', 'publicidad'].includes(data.category) ||
    !Number.isInteger(data.quantity) ||
    data.quantity <= 0 ||
    !Number.isFinite(data.quoteTotal) ||
    data.quoteTotal < 0
  )
    throw new Error('Datos del pedido inválidos.')
  const oldSnapshot = editingId ? await tx.get(orderRef) : null
  if (editingId && !oldSnapshot.exists())
    throw new Error('El pedido ya no existe.')
  const old = oldSnapshot?.data()
  if (old && categoryOf(old) !== data.category)
    throw new Error('No se puede cambiar la categoría de un pedido guardado.')
  if (old?.status === 'anulado')
    throw new Error('No se puede editar un pedido anulado.')
  const oldId =
    old?.productId && (!old.garmentSource || old.garmentSource === 'inventory')
      ? old.productId
      : null
  const newId = data.garmentSource === 'inventory' ? data.productId : null
  const ids = [...new Set([oldId, newId].filter(Boolean))]
  const stocks = new Map()
  for (const id of ids) stocks.set(id, await tx.get(doc(db, 'products', id)))
  if (newId) {
    const product = stocks.get(newId)
    if (!product.exists() || product.data().active === false)
      throw new Error('El producto no está disponible.')
    if (categoryOf(product.data()) !== data.category)
      throw new Error('El producto no corresponde a la categoría del pedido.')
    if (!product.data().size && product.data().sizes?.length > 1)
      throw new Error('Separa el inventario antiguo por talla antes de usarlo.')
    if (
      data.category === 'prenda' &&
      String(product.data().size || product.data().sizes?.[0] || '') !==
        data.size
    )
      throw new Error(
        'La talla del inventario cambió. Vuelve a seleccionar el producto.',
      )
  }
  const initial = Number(old?.depositPaid || 0),
    final = Number(old?.finalPaymentPaid || 0)
  const paid = money(initial + final)
  if (paid > data.quoteTotal)
    throw new Error(
      'El nuevo total es menor al monto ya cobrado. Revisa los pagos antes de editar.',
    )
  if (old?.status === 'entregado' && data.quoteTotal !== Number(old.quoteTotal))
    throw new Error(
      'Reabre el pedido antes de modificar el total de una entrega.',
    )
  if (paid > 0 && old.paymentPlan !== data.paymentPlan)
    throw new Error(
      'Cambia la forma de pago desde el historial para confirmar el ajuste.',
    )
  for (const id of ids) {
    const snap = stocks.get(id)
    if (!snap.exists()) {
      if (id === newId) throw new Error('El producto ya no existe.')
      continue
    }
    const available =
      Number(snap.data().stock || 0) +
      (id === oldId ? Number(old.quantity) : 0) -
      (id === newId ? data.quantity : 0)
    if (!Number.isInteger(available) || available < 0)
      throw new Error('No hay suficiente stock para guardar el pedido.')
    tx.update(snap.ref, { stock: available })
  }
  const now = new Date().toISOString()
  const changes = {
    ...data,
    initialPaymentAmount: money(
      data.paymentPlan === 'completo' ? data.quoteTotal : data.quoteTotal * 0.5,
    ),
    depositPaid: initial,
    finalPaymentPaid: final,
    totalPaid: paid,
    balanceDue: money(data.quoteTotal - paid),
    paymentStatus:
      paid >= data.quoteTotal
        ? 'pagado'
        : paid > 0
          ? 'pago_parcial'
          : 'pendiente_pago',
    updatedAt: now,
  }
  if (old) tx.update(orderRef, changes)
  else
    tx.set(orderRef, {
      ...changes,
      status: 'pendiente_aprobacion',
      createdAt: now,
    })
}
