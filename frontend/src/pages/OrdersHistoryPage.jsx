import { useEffect, useState, useRef, useId } from 'react'
import { useNavigate } from 'react-router-dom'
import { db, storage } from '../firebase/config'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  serverTimestamp,
  arrayUnion,
  getDoc
} from 'firebase/firestore'
import { ref, deleteObject } from 'firebase/storage'
import OrderAIValidationDetails from '../components/OrderAIValidationDetails'
import { useAuth } from '../context/AuthContext'
import {
  localDateValue,
  displayOrderDate,
  getProductName,
  getPaymentSummary,
  getStatusBadge
} from '../services/orderFormatting'
import { generateOrderPdf } from '../services/orderPdfService'
import { notify } from '../services/toastStore'
import { askConfirm, askPrompt } from '../services/dialogStore'
import '../styles/statusBadges.css'
import '../styles/OrdersHistoryPage.css'

function deliveryEvents(order) {
  return Array.isArray(order.deliveryHistory) ? order.deliveryHistory : []
}

function isRepairEntry(entry) {
  return entry.action === 'estado_reabierto' && entry.status === 'en_arreglo'
}

function isDeliveryEntry(entry) {
  return entry.action === 'entrega_confirmada' || entry.action === 'entrega_arreglo'
}

function describeDeliveries(order) {
  const events = deliveryEvents(order)
  const entries = []
  if (order.deliveredAt && (
    !events.some(isDeliveryEntry) ||
    new Date(order.deliveredAt.toDate?.() ?? order.deliveredAt) < new Date(events[0].recordedAt)
  )) {
    entries.push({ date: order.deliveredAt, label: 'Entrega confirmada' })
  }

  let repairPending = false
  for (const event of events) {
    let label
    if (isRepairEntry(event)) {
      label = 'Ingreso a arreglo o devolución'
      repairPending = true
    } else if (isDeliveryEntry(event)) {
      label = repairPending || event.action === 'entrega_arreglo'
        ? 'Entrega después del arreglo'
        : 'Entrega confirmada'
      repairPending = false
    } else if (event.action === 'estado_reabierto') {
      label = 'Pedido reabierto'
    }
    if (label) entries.push({ date: event.recordedAt, label })
  }
  return entries
}

// Ventana de consulta: no vuelve a llamar a la IA ni modifica el pedido.
function AIValidationPopover({ order }) {
  const [open, setOpen] = useState(false)
  const pinned = useRef(false)
  const container = useRef(null)
  const trigger = useRef(null)
  const panelId = useId()

  const close = () => {
    pinned.current = false
    setOpen(false)
  }

  useEffect(() => {
    if (!open) return
    const onOutside = (event) => {
      if (!container.current?.contains(event.target)) close()
    }
    const onEscape = (event) => {
      if (event.key === 'Escape') {
        close()
        if (container.current?.contains(document.activeElement)) {
          trigger.current?.focus()
          setOpen(false)
        }
      }
    }
    document.addEventListener('pointerdown', onOutside)
    document.addEventListener('keydown', onEscape)
    return () => {
      document.removeEventListener('pointerdown', onOutside)
      document.removeEventListener('keydown', onEscape)
    }
  }, [open])

  return (
    <div
      className="history-ai"
      ref={container}
      onMouseEnter={() => setOpen(true)}
      onMouseLeave={() => {
        if (!pinned.current && !container.current?.contains(document.activeElement)) {
          setOpen(false)
        }
      }}
      onBlur={(event) => {
        if (!event.currentTarget.contains(event.relatedTarget)) close()
      }}
    >
      <button
        ref={trigger}
        type="button"
        className="history-ai-button"
        aria-expanded={open}
        aria-controls={panelId}
        onFocus={() => setOpen(true)}
        onClick={() => {
          pinned.current = !pinned.current
          setOpen(pinned.current)
        }}
      >
        <span aria-hidden="true">🤖</span> Ver validación inteligente
      </button>
      {open && (
        <div className="history-ai-position">
          <section
            id={panelId}
            className="history-ai-panel"
            aria-label="Validación inteligente del pedido"
            tabIndex={0}
          >
            {order.aiValidation ? (
              <OrderAIValidationDetails
                validation={order.aiValidation}
                validatedAt={order.aiValidatedAt}
              />
            ) : (
              <p className="mb-0 text-muted">Este pedido no tiene una validación guardada.</p>
            )}
          </section>
        </div>
      )}
    </div>
  )
}


function OrdersHistoryPage() {
  const { role } = useAuth()
  const isAdmin = role === 'admin'

  const [orders, setOrders] = useState([])
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')
  // Por defecto el filtro arranca en la fecha de hoy.
  const [dateFilter, setDateFilter] = useState(() =>
    localDateValue(new Date())
  )

  const navigate = useNavigate()

  const loadOrders = async () => {
    try {
      const querySnapshot = await getDocs(
        collection(db, 'orders')
      )

      const ordersData = querySnapshot.docs.map(
        (orderDoc) => ({
          ...orderDoc.data(),
          id: orderDoc.id
        })
      )

      setOrders(ordersData)
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const handleChangeStatus = async (orderId, newStatus) => {
  const order = orders.find((item) => item.id === orderId)

  if (!order || order.status === newStatus) return

  if (newStatus === 'anulado') {
    await handleCancelOrder(order)
    return
  }

  const allowedStatuses = [
    'pendiente_aprobacion',
    'aprobado',
    'en_produccion',
    'en_arreglo',
    'terminado',
    'entregado'
  ]

  if (!allowedStatuses.includes(newStatus)) return

  const total = Number(order.quoteTotal)

  if (!Number.isFinite(total) || total < 0) {
    notify('El pedido no tiene un total válido.', 'warning')
    return
  }

  const roundMoney = (value) =>
    Math.round((value + Number.EPSILON) * 100) / 100

  // Recuperar el pago inicial sin usar el saldo que pudo
  // haberse puesto en cero al entregar.
  let initialPayment = Number(order.initialPaymentAmount)

  if (
    order.initialPaymentAmount == null ||
    !Number.isFinite(initialPayment)
  ) {
    const previousDeposit = Number(order.depositPaid)

    // Compatibilidad con pedidos anteriores.
    if (
      Number.isFinite(previousDeposit) &&
      previousDeposit > 0
    ) {
      initialPayment = previousDeposit
    } else {
      initialPayment =
        order.paymentPlan === 'completo'
          ? total
          : roundMoney(total * 0.5)
    }
  }

  initialPayment = roundMoney(
    Math.min(total, Math.max(0, initialPayment))
  )

  const previousStatus =
    order.status || 'pendiente_aprobacion'

  // Los pedidos nuevos deben pasar primero por aprobación.
  if (
    previousStatus === 'pendiente_aprobacion' &&
    newStatus !== 'aprobado'
  ) {
    notify('Primero debes aprobar el pedido y confirmar el pago inicial.', 'warning')
    return
  }

  if (
    previousStatus === 'pendiente_aprobacion' &&
    newStatus === 'aprobado'
  ) {
    const confirmed = await askConfirm(
      `¿Confirmás que recibiste Q${initialPayment.toFixed(2)} ` +
      'como pago inicial y deseas aprobar el pedido?',
      { confirmLabel: 'Sí, aprobar' }
    )

    if (!confirmed) return
  }

  if (newStatus === 'entregado') {
    const pending = roundMoney(
      Math.max(0, total - initialPayment)
    )

    const confirmed = await askConfirm(
      `¿Confirmás que el pedido fue entregado y está totalmente pagado? ` +
      `El saldo a liquidar es Q${pending.toFixed(2)}.`,
      { confirmLabel: 'Sí, entregado' }
    )

    if (!confirmed) return
  }

  if (previousStatus === 'entregado') {
    const confirmed = await askConfirm(
      'Vas a corregir una entrega registrada. ' +
      'Se revertirá el registro del pago final y se recuperará ' +
      'el saldo correspondiente al estado seleccionado. ¿Continuar?'
    )

    if (!confirmed) return
  } else if (newStatus === 'pendiente_aprobacion') {
    const confirmed = await askConfirm(
      'Al regresar a pendiente se quitará la confirmación del pago inicial. ' +
      'El importe previsto se conservará para volver a aprobar. ¿Continuar?'
    )

    if (!confirmed) return
  }

  const paid =
    newStatus === 'pendiente_aprobacion'
      ? 0
      : initialPayment

  const finalPayment =
    newStatus === 'entregado'
      ? roundMoney(total - initialPayment)
      : 0

  const changes = {
    status: newStatus,
    initialPaymentAmount: initialPayment,

    // Pago inicial confirmado.
    depositPaid: paid,

    // Pago realizado al entregar.
    finalPaymentPaid: finalPayment,

    // Total efectivamente registrado como pagado.
    totalPaid: roundMoney(paid + finalPayment),

    balanceDue: roundMoney(
      Math.max(0, total - paid - finalPayment)
    ),

    updatedAt: new Date().toISOString()
  }

  changes.paymentStatus = getPaymentSummary({ ...order, ...changes }).status

  if (newStatus === 'entregado') {
    // Conservar la primera entrega y cada confirmación posterior.
    if (!order.deliveredAt) changes.deliveredAt = serverTimestamp()
    const lastDeliveryEvent = deliveryEvents(order).findLast(
      (entry) => isRepairEntry(entry) || isDeliveryEntry(entry),
    )
    const isRepairDelivery = (!order.category || order.category === 'prenda') &&
      (previousStatus === 'en_arreglo' ||
        (lastDeliveryEvent && isRepairEntry(lastDeliveryEvent)))
    changes.deliveryHistory = arrayUnion({
      action: isRepairDelivery ? 'entrega_arreglo' : 'entrega_confirmada',
      recordedAt: new Date().toISOString()
    })
  } else if (
    previousStatus === 'entregado' ||
    (newStatus === 'en_arreglo' && (!order.category || order.category === 'prenda'))
  ) {
    changes.deliveryHistory = arrayUnion({
      action: 'estado_reabierto',
      status: newStatus,
      recordedAt: new Date().toISOString()
    })
  }


  try {
    // Guardar estado e importes juntos.
    await updateDoc(doc(db, 'orders', orderId), changes)

    // Leer los valores resueltos por Firestore (timestamps y arrays).
    const savedOrder = await getDoc(doc(db, 'orders', orderId))
    if (savedOrder.exists()) {
      setOrders((prev) => prev.map((item) => item.id === orderId
        ? { ...savedOrder.data(), id: orderId }
        : item))
    }

  } catch (error) {
    console.error('Error actualizando pedido:', error)
    notify('No se pudo actualizar el pedido. Intenta nuevamente.', 'error')
  }
}

const handleRegisterBalancePayment = async (order) => {
  await handleChangeStatus(order.id, 'entregado')
}

  const handleChangePaymentPlan = async (order, newPlan) => {
    if (!newPlan || newPlan === order.paymentPlan) return

    if (['entregado', 'anulado'].includes(order.status)) {
      notify('No se puede cambiar la forma de pago de un pedido entregado o anulado.', 'warning')
      return
    }

    const total = Number(order.quoteTotal) || 0

    const roundMoney = (value) =>
      Math.round((value + Number.EPSILON) * 100) / 100

    const newInitialPayment =
      newPlan === 'completo'
        ? total
        : roundMoney(total * 0.5)

    const alreadyApproved =
      order.status && order.status !== 'pendiente_aprobacion'

    const confirmed = await askConfirm(
      newPlan === 'completo'
        ? `El cliente pagará el total (Q${total.toFixed(2)}) en lugar del anticipo del 50%. ¿Continuar?`
        : `El cliente pagará un anticipo del 50% (Q${newInitialPayment.toFixed(2)}) en lugar del pago completo. ¿Continuar?`
    )

    if (!confirmed) return

    const changes = {
      paymentPlan: newPlan,
      initialPaymentAmount: newInitialPayment,
      updatedAt: new Date().toISOString()
    }

    // Si el pedido ya fue aprobado (el anticipo/pago inicial ya se
    // registró como cobrado), actualizamos también lo que se
    // considera pagado y el saldo pendiente.
    if (alreadyApproved && order.status !== 'entregado') {
      changes.depositPaid = newInitialPayment
      changes.balanceDue = roundMoney(
        Math.max(0, total - newInitialPayment)
      )
      changes.paymentStatus = getPaymentSummary({
        ...order,
        ...changes
      }).status
    }

    try {
      await updateDoc(doc(db, 'orders', order.id), changes)

      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? { ...item, ...changes }
            : item
        )
      )
    } catch (error) {
      console.error('Error cambiando forma de pago:', error)
      notify('No se pudo actualizar la forma de pago. Intenta nuevamente.', 'error')
    }
  }

  const handleCancelOrder = async (order) => {
    const reason = await askPrompt(
      'Motivo de anulación del pedido:',
      { confirmLabel: 'Anular pedido', danger: true, placeholder: 'Ej. el cliente canceló el pedido' }
    )

    if (!reason) return

    const cancelledAt = new Date().toISOString()
    const paymentStatus = getPaymentSummary({ ...order, status: 'anulado' }).status

    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'anulado',
        cancelReason: reason,
        paymentStatus,
        cancelledAt
      })

      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: 'anulado',
                cancelReason: reason,
                paymentStatus,
                cancelledAt
              }
            : item
        )
      )
    } catch (error) {
      console.error('Error anulando pedido:', error)
    }
  }

  const handleDeleteOrder = async (order) => {
    const willRestock =
      (order.garmentSource === 'inventory' || !order.garmentSource) &&
      order.productId &&
      Number(order.quantity) > 0

    const confirmed = await askConfirm(
      `Esto va a ELIMINAR PERMANENTEMENTE el pedido de "${
        order.customerName || 'sin nombre'
      }".` +
      (willRestock
        ? ` Se devolverán ${order.quantity} unidad(es) al inventario del producto.`
        : '') +
      ' No se puede deshacer. ¿Continuar?',
      { confirmLabel: 'Eliminar definitivamente', danger: true }
    )

    if (!confirmed) return

    try {
      if (willRestock) {
        const productRef = doc(db, 'products', order.productId)
        const productSnap = await getDoc(productRef)

        if (productSnap.exists()) {
          const currentStock = Number(productSnap.data().stock || 0)

          await updateDoc(productRef, {
            stock: currentStock + Number(order.quantity)
          })
        }
      }

      // Si el pedido tiene una vista previa subida a Firebase Storage,
      // la borramos para no dejar imágenes huérfanas. Es una limpieza
      // de mejor esfuerzo: si el archivo ya no existe o falla, no debe
      // impedir que el pedido se elimine de Firestore.
      if (order.previewPath || order.previewImage) {
        try {
          const previewRef = ref(
            storage,
            order.previewPath || order.previewImage
          )

          await deleteObject(previewRef)
        } catch (storageError) {
          console.warn(
            'No se pudo eliminar la vista previa en Storage:',
            storageError
          )
        }
      }

      await deleteDoc(doc(db, 'orders', order.id))

      setOrders((prev) =>
        prev.filter((item) => item.id !== order.id)
      )
    } catch (error) {
      console.error('Error eliminando pedido:', error)
      notify('No se pudo eliminar el pedido. Intenta nuevamente.', 'error')
    }
  }

  const generateWhatsAppLink = (order) => {
    const payment = getPaymentSummary(order)
    const message = `
Hola ${order.customerName || ''},

Tu pedido está en estado: ${
      getStatusBadge(order.status).label
    }

Detalle:
Prenda: ${getProductName(order)}
Talla: ${order.size || 'No definida'}
Cantidad: ${order.quantity || 0}
Técnica: ${order.technique || 'No definida'}

Situación de pago: ${payment.label}
Total: Q${payment.total.toFixed(2)}
Anticipo / pago inicial: Q${payment.initial.toFixed(2)}
Pago final: Q${payment.final.toFixed(2)}
Saldo: Q${payment.balance.toFixed(2)}

Vista previa:
${order.previewImage || 'No disponible'}
    `.trim()

    const encodedMessage = encodeURIComponent(message)

    // Defensivo: si el pedido es de antes de validar el teléfono al
    // capturarlo, se limpia aquí también para que el link a WhatsApp
    // nunca quede roto por letras o espacios guardados previamente.
    const digitsOnlyPhone = String(order.phone || '').replace(/\D/g, '')

    return `https://wa.me/502${digitsOnlyPhone}?text=${encodedMessage}`
  }

  // Buscar usando el mismo nombre que se muestra en la tarjeta.
  const filteredOrders = orders.filter((order) => {
    const searchText = search.trim().toLowerCase()

    const matchesSearch =
      String(order.customerName || '')
        .toLowerCase()
        .includes(searchText) ||
      getProductName(order)
        .toLowerCase()
        .includes(searchText)

    const matchesStatus =
      statusFilter === '' ||
      order.status === statusFilter

    const orderDate = localDateValue(
      order.orderDate || order.createdAt
    )

    const matchesDate =
      !dateFilter || orderDate === dateFilter

    return matchesSearch && matchesStatus && matchesDate
  })

  return (
    <div className="dashboard-page">
      <div className="history-header">
        <h2 className="page-title">Historial de pedidos</h2>

        <div className="history-date-filter">
          <input
            id="historyDateFilter"
            type="date"
            aria-label="Fecha del pedido"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
            onClick={(event) => {
              try {
                event.currentTarget.showPicker?.()
              } catch {
                // El control nativo sigue disponible en vistas incrustadas.
              }
            }}
          />
        </div>
      </div>

      {orders.length === 0 && (
        <p className="text-muted">
          No hay pedidos registrados.
        </p>
      )}

      <div className="card p-3 mb-3">
        <div className="row g-2">
          <div className="col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por cliente o artículo..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />
          </div>

          <div className="col-md-6">
            <select
              className="form-control"
              value={statusFilter}
              onChange={(event) =>
                setStatusFilter(event.target.value)
              }
            >
              <option value="">Todos los estados</option>
              <option value="pendiente_aprobacion">
                Pendiente
              </option>
              <option value="aprobado">Aprobado</option>
              <option value="en_produccion">
                Producción
              </option>
              <option value="en_arreglo">
                En arreglo / devolución
              </option>
              <option value="terminado">Terminado</option>
              <option value="entregado">Entregado</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>
        </div>
      </div>

      {filteredOrders.map((order) => {
        const isGarment = !order.category || order.category === 'prenda'
        const deliveries = isGarment ? describeDeliveries(order) : []
        const usesProductLayout = order.category === 'producto' || order.category === 'publicidad'
        const description = order.description?.trim()
        const specifications = order.personalizationSize?.trim()
        const isCancelled = order.status === 'anulado'
        const isDelivered = order.status === 'entregado'
        const payment = getPaymentSummary(order)
        const statusControl = (
          <div className="history-status-change">
            <label
              className="history-status-eyebrow"
              htmlFor={`history-status-select-${order.id}`}
            >
              Estado
            </label>

            <select
              id={`history-status-select-${order.id}`}
              className="form-select form-select-sm"
              value={
                order.status || 'pendiente_aprobacion'
              }
              disabled={isCancelled}
              onChange={(event) =>
                handleChangeStatus(
                  order.id,
                  event.target.value
                )
              }
            >
              <option value="pendiente_aprobacion">
                Pendiente de aprobación
              </option>
              <option value="aprobado">
                Aprobado
              </option>
              <option value="en_produccion">
                En producción
              </option>
              {!usesProductLayout && (
                <option value="en_arreglo">
                  En arreglo / devolución
                </option>
              )}
              {usesProductLayout && order.status === 'en_arreglo' && (
                <option value="en_arreglo" disabled>Estado anterior</option>
              )}
              <option value="terminado">
                Terminado
              </option>
              <option value="entregado">
                Entregado
              </option>
              <option value="anulado">
                Anulado
              </option>
            </select>
          </div>
        )

        return (
          <div
            key={order.id}
            className={`history-order-card ${
              isCancelled ? 'is-cancelled' : ''
            }`}
          >
            <div className="row g-0">
              <div className="col-md-3 p-3 pe-md-2">
                <img
                  src={order.previewImage}
                  className="img-fluid rounded history-order-image"
                  alt="Vista previa del pedido"
                />
              </div>

              <div className="col-md-9">
                <div className="card-body p-3 ps-md-2">
                  <div className="history-card-heading">
                    <h5 className="card-title">{getProductName(order)}</h5>
                    {isGarment && <AIValidationPopover order={order} />}
                  </div>

                  <div className="history-info-grid">
                    <div>
                      <span className="history-info-label">Cliente</span>
                      <strong>{order.customerName || 'No definido'}</strong>
                    </div>

                    <div>
                      <span className="history-info-label">Teléfono</span>
                      <strong>{order.phone || 'No definido'}</strong>
                    </div>

                    {isGarment && (
                      <div>
                        <span className="history-info-label">Talla</span>
                        <strong>{order.size || 'No definida'}</strong>
                      </div>
                    )}

                    <div>
                      <span className="history-info-label">Cantidad</span>
                      <strong>{order.quantity || 0}</strong>
                    </div>

                    {isGarment && (
                      <div>
                        <span className="history-info-label">Técnica</span>
                        <strong>{order.technique || 'No definida'}</strong>
                      </div>
                    )}
                  </div>

                  <div className="history-dates-row">
                    <span><strong>Fecha del pedido:</strong> {displayOrderDate(order.orderDate || order.createdAt)}</span>
                    <span><strong>Entrega prevista:</strong> {displayOrderDate(order.expectedDeliveryDate)}</span>
                  </div>
                  {deliveries.length > 0 && (
                    <details className="small mb-2">
                      <summary>Historial de entregas (incluye arreglos y devoluciones)</summary>
                      <ul className="mt-2">
                        {deliveries.map((entry, index) => (
                          <li key={index}>
                            {displayOrderDate(entry.date)} — {entry.label}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <div className="history-quote-box">
                    <div className="history-quote-total">
                      <span>Total cotizado</span>
                      <strong>Q{payment.total.toFixed(2)}</strong>
                      <span className={`badge ${payment.badge}`}>
                        {payment.label}
                      </span>
                    </div>

                    <div className="history-quote-rows">
                      <span><strong>Anticipo / pago inicial:</strong> Q{payment.initial.toFixed(2)}</span>
                      <span><strong>Pago final:</strong> Q{payment.final.toFixed(2)}</span>
                      <span><strong>Total pagado:</strong> Q{payment.paid.toFixed(2)}</span>
                      <span className={payment.balance > 0 ? 'history-balance-due' : 'history-balance-clear'}>
                        <strong>Saldo pendiente: Q{payment.balance.toFixed(2)}</strong>
                      </span>
                    </div>

                    <div className="history-payment-plan-row column-gap-4">
                      {!isCancelled && !isDelivered && (
                        <div className="d-flex align-items-center gap-2">
                          <label className="small mb-0 text-nowrap" htmlFor={`history-payment-plan-${order.id}`}>
                            <strong>Forma de pago:</strong>
                          </label>
                          <select
                            id={`history-payment-plan-${order.id}`}
                            className="form-select form-select-sm history-payment-plan-select w-auto"
                            value={order.paymentPlan || 'anticipo_50'}
                            onChange={(event) => handleChangePaymentPlan(order, event.target.value)}
                          >
                            <option value="anticipo_50">Anticipo 50%</option>
                            <option value="completo">Pago completo</option>
                          </select>
                        </div>
                      )}
                      {statusControl}
                    </div>
                  </div>

                  {usesProductLayout && (description || specifications) && (
                    <dl className="row g-2 mb-0 mt-1 px-2 py-1 small">
                      {description && (
                        <div className={specifications ? 'col-md-7' : 'col-12'}>
                          <dt className="history-info-label">Descripción o comentario</dt>
                          <dd className="text-break mb-0" style={{ whiteSpace: 'pre-wrap' }}>{description}</dd>
                        </div>
                      )}
                      {specifications && (
                        <div className={description ? 'col-md-5' : 'col-12'}>
                          <dt className="history-info-label">Tamaño o especificaciones</dt>
                          <dd className="text-break mb-0" style={{ whiteSpace: 'pre-wrap' }}>{specifications}</dd>
                        </div>
                      )}
                    </dl>
                  )}

                  {isCancelled && (
                    <p className="history-cancel-reason">
                      <strong>Motivo de anulación:</strong>{' '}
                      {order.cancelReason || 'No definido'}
                    </p>
                  )}

                  <div className="history-actions-row">
                    <button
                      className="btn btn-outline-primary"
                      onClick={async () => {
                        try {
                          await generateOrderPdf(order)
                        } catch (error) {
                          console.error(
                            'Error generando el PDF del pedido:',
                            error
                          )
                          notify(
                            'No se pudo generar el PDF del pedido',
                            'error'
                          )
                        }
                      }}
                    >
                      Descargar pedido PDF
                    </button>

                    <a
                      href={generateWhatsAppLink(order)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-dark"
                      style={
                        isCancelled
                          ? {
                              pointerEvents: 'none',
                              opacity: 0.5
                            }
                          : {}
                      }
                    >
                      Enviar por WhatsApp
                    </a>

                    <button
                      className="btn btn-warning"
                      onClick={() =>
                        navigate('/crearpedido', {
                          state: {
                            orderToEdit: order
                          }
                        })
                      }
                      disabled={isCancelled}
                    >
                      Editar datos
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() =>
                        handleCancelOrder(order)
                      }
                      disabled={isCancelled}
                    >
                      Anular
                    </button>

                    {payment.balance > 0 &&
                      ['aprobado', 'en_produccion', 'en_arreglo', 'terminado'].includes(order.status) && (
                      <button
                        className="btn btn-dark"
                        onClick={() =>
                          handleRegisterBalancePayment(order)
                        }
                      >
                        Registrar saldo y entregar
                      </button>
                    )}

                    {isAdmin && (
                      <button
                        className="btn btn-outline-danger"
                        onClick={() =>
                          handleDeleteOrder(order)
                        }
                      >
                        Eliminar pedido
                      </button>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>
        )
      })}
    </div>
  )
}

export default OrdersHistoryPage
