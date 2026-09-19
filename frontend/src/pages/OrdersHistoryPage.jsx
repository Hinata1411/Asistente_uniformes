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
import jsPDF from 'jspdf'
import OrderAIValidationDetails from '../components/OrderAIValidationDetails'
import { useAuth } from '../context/AuthContext'

// Obtener el nombre desde los campos disponibles del pedido.
const localDateValue = (value) => {
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

const displayOrderDate = (value) => {
  const date = localDateValue(value)
  return date ? date.split('-').reverse().join('/') : 'No registrada'
}

const getProductName = (order) => {
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


const getPaymentSummary = (order) => {
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
    status = order.status === 'entregado' ? 'entregado_pagado' : 'pagado'
    label = order.status === 'entregado' ? 'Entregado y pagado' : 'Pagado'
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
const STATUS_BADGE_META = {
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

const getStatusBadge = (status) =>
  STATUS_BADGE_META[status] || STATUS_BADGE_META.pendiente_aprobacion

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
            <div className="history-ai-heading">
              <strong>Validación inteligente</strong>
              <button
                type="button"
                className="history-ai-close"
                aria-label="Cerrar validación inteligente"
                onClick={() => {
                  trigger.current?.focus()
                  close()
                }}
              >×</button>
            </div>
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

const historyCompactStyles = `
.status-badge {
  display:inline-flex; align-items:center; padding:4px 11px;
  border-radius:999px; font-size:12px; font-weight:700; line-height:1.3;
}
.status-badge-amber { background:#fff4cc; color:#7a5e00; border:1px solid #f0d878; }
.status-badge-gold { background:#ffc603; color:#1a1a1a; }
.status-badge-black { background:#000000; color:#ffc603; }
.status-badge-outline { background:transparent; color:#1a1a1a; border:1px solid #ffc603; }
.status-badge-slate { background:#4b5563; color:#ffffff; }
.status-badge-green { background:#16a34a; color:#ffffff; }
.status-badge-red { background:#dc2626; color:#ffffff; }
.orders-history-compact .history-order-image {
  width:100%; height:210px; object-fit:contain; background:#f7f8fa;
}
.orders-history-compact .history-card-heading {
  display:flex; justify-content:space-between; align-items:flex-start;
  flex-wrap:wrap; gap:12px; margin-bottom:10px;
}
.orders-history-compact .history-card-heading h5 { margin:0; }
.orders-history-compact .history-ai { position:relative; margin-left:auto; }
.orders-history-compact .history-ai-button {
  border:1px solid #e6bd00; background:#fff6cc; color:#242424;
  border-radius:10px; padding:9px 13px; font-size:13px; font-weight:600;
  display:inline-flex; align-items:center; gap:7px; cursor:pointer;
  transition:background .15s ease, box-shadow .15s ease;
}
.orders-history-compact .history-ai-button:hover { background:#ffdf65; }
.orders-history-compact .history-ai-button:focus-visible,
.orders-history-compact .history-ai-close:focus-visible {
  outline:3px solid #705800; outline-offset:3px;
}
.orders-history-compact .history-ai-position {
  position:absolute; top:100%; right:0; padding-top:8px;
  width:min(520px, calc(100vw - 64px)); z-index:1050;
}
.orders-history-compact .history-ai-panel {
  background:#fff; color:#222; border:1px solid #e6e8ed;
  border-top:3px solid #ffd000; border-radius:12px;
  box-shadow:0 14px 40px rgba(0,0,0,.18); padding:16px;
  max-height:min(460px, 65vh); overflow:auto; overflow-wrap:anywhere;
  font-size:13px;
}
.orders-history-compact .history-ai-heading {
  display:flex; justify-content:space-between; align-items:center;
  gap:12px; margin-bottom:12px;
}
.orders-history-compact .history-ai-close {
  background:#f1f2f4; border:0; border-radius:7px;
  width:32px; height:32px; font-size:22px; cursor:pointer;
}
.orders-history-compact .history-payment-plan-select {
  min-width:180px;
}
.orders-history-compact .history-header {
  display:flex; align-items:flex-start; justify-content:space-between;
  flex-wrap:wrap; gap:14px; margin-bottom:18px;
}
.orders-history-compact .history-date-filter {
  display:flex; align-items:center; gap:10px;
  padding:10px 16px;
  background:#111; border:2px solid #ffc603; border-radius:999px;
}
.orders-history-compact .history-date-filter label {
  margin:0; color:#ffc603; font-size:12px; font-weight:700;
  text-transform:uppercase; letter-spacing:.03em; white-space:nowrap;
}
.orders-history-compact .history-date-filter input[type="date"] {
  border:none; background:transparent; color:#fff;
  font-size:14px; font-weight:600; padding:2px 4px;
}
.orders-history-compact .history-date-filter input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(1);
  cursor:pointer;
}
@media (max-width:575px) {
  .orders-history-compact .history-date-filter { width:100%; }
}
@media (max-width:767px) {
  .orders-history-compact .history-order-image { height:160px; }
}
@media (prefers-reduced-motion:reduce) {
  .orders-history-compact .history-ai-button { transition:none; }
}
`

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
    alert('El pedido no tiene un total válido.')
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
    alert('Primero debes aprobar el pedido y confirmar el pago inicial.')
    return
  }

  if (
    previousStatus === 'pendiente_aprobacion' &&
    newStatus === 'aprobado'
  ) {
    const confirmed = window.confirm(
      `¿Confirmás que recibiste Q${initialPayment.toFixed(2)} ` +
      'como pago inicial y deseas aprobar el pedido?'
    )

    if (!confirmed) return
  }

  if (newStatus === 'entregado') {
    const pending = roundMoney(
      Math.max(0, total - initialPayment)
    )

    const confirmed = window.confirm(
      `¿Confirmás que el pedido fue entregado y está totalmente pagado? ` +
      `El saldo a liquidar es Q${pending.toFixed(2)}.`
    )

    if (!confirmed) return
  }

  if (previousStatus === 'entregado') {
    const confirmed = window.confirm(
      'Vas a corregir una entrega registrada. ' +
      'Se revertirá el registro del pago final y se recuperará ' +
      'el saldo correspondiente al estado seleccionado. ¿Continuar?'
    )

    if (!confirmed) return
  } else if (newStatus === 'pendiente_aprobacion') {
    const confirmed = window.confirm(
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
    changes.deliveryHistory = arrayUnion({
      action: 'entrega_confirmada',
      recordedAt: new Date().toISOString()
    })
  } else if (previousStatus === 'entregado') {
    // Regresar de estado NO borra la fecha real de entrega.
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
    alert('No se pudo actualizar el pedido. Intenta nuevamente.')
  }
}

const handleRegisterBalancePayment = async (order) => {
  await handleChangeStatus(order.id, 'entregado')
}

  const handleChangePaymentPlan = async (order, newPlan) => {
    if (!newPlan || newPlan === order.paymentPlan) return

    if (['entregado', 'anulado'].includes(order.status)) {
      alert('No se puede cambiar la forma de pago de un pedido entregado o anulado.')
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

    const confirmed = window.confirm(
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
      alert('No se pudo actualizar la forma de pago. Intenta nuevamente.')
    }
  }

  const handleCancelOrder = async (order) => {
    const reason = window.prompt(
      'Motivo de anulación del pedido:'
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

    const confirmed = window.confirm(
      `Esto va a ELIMINAR PERMANENTEMENTE el pedido de "${
        order.customerName || 'sin nombre'
      }".` +
      (willRestock
        ? ` Se devolverán ${order.quantity} unidad(es) al inventario del producto.`
        : '') +
      ' No se puede deshacer. ¿Continuar?'
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
      alert('No se pudo eliminar el pedido. Revisa la consola.')
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

    return `https://wa.me/502${order.phone}?text=${encodedMessage}`
  }

  const handleDownloadOrderPDF = (order) => {
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
    <div className="container mt-4 orders-history-compact">
      <style>{historyCompactStyles}</style>

      <div className="history-header">
        <h2 className="mb-0">Historial de pedidos</h2>

        <div className="history-date-filter">
          <label htmlFor="historyDateFilter">
          </label>
          <input
            id="historyDateFilter"
            type="date"
            value={dateFilter}
            onChange={(event) => setDateFilter(event.target.value)}
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
              placeholder="Buscar por cliente o prenda..."
              value={search}
              onChange={(event) =>
                setSearch(event.target.value)
              }
            />

            <button
              type="button"
              className="btn btn-outline-secondary btn-sm mt-2"
              disabled={!dateFilter}
              onClick={() => setDateFilter('')}
            >
              Quitar filtro de fecha
            </button>
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
        const isCancelled = order.status === 'anulado'
        const isDelivered = order.status === 'entregado'
        const payment = getPaymentSummary(order)

        return (
          <div
            key={order.id}
            className={`card mb-3 shadow-sm border-0 ${
              isCancelled ? 'bg-light border-danger' : ''
            }`}
          >
            <div className="row g-0">
              <div className="col-md-3 p-2">
                <img
                  src={order.previewImage}
                  className="img-fluid rounded history-order-image"
                  alt="Vista previa del pedido"
                />
              </div>

              <div className="col-md-9">
                <div className="card-body">
                  <div className="history-card-heading">
                    <h5 className="card-title">{getProductName(order)}</h5>
                    <AIValidationPopover order={order} />
                  </div>

                  <p className="mb-1">
                    <strong>Cliente:</strong>{' '}
                    {order.customerName || 'No definido'}
                  </p>

                  <p className="mb-1">
                    <strong>Teléfono:</strong>{' '}
                    {order.phone || 'No definido'}
                  </p>

                  <p className="mb-1">
                    <strong>Talla:</strong>{' '}
                    {order.size || 'No definida'}
                  </p>

                  <p className="mb-1">
                    <strong>Cantidad:</strong>{' '}
                    {order.quantity || 0}
                  </p>

                  <div className="d-flex flex-wrap gap-3 small text-muted mb-2">
                    <span><strong>Fecha del pedido:</strong> {displayOrderDate(order.orderDate || order.createdAt)}</span>
                    <span><strong>Entrega prevista:</strong> {displayOrderDate(order.expectedDeliveryDate)}</span>
                    <span><strong>Primera entrega real:</strong> {displayOrderDate(order.deliveredAt)}</span>
                  </div>
                  {Array.isArray(order.deliveryHistory) && order.deliveryHistory.length > 0 && (
                    <details className="small mb-2">
                      <summary>Historial de entregas ({order.deliveryHistory.length})</summary>
                      <ul className="mt-2">
                        {order.deliveryHistory.map((entry, index) => (
                          <li key={index}>
                            {displayOrderDate(entry.recordedAt)} — {entry.action === 'entrega_confirmada'
                              ? 'Entrega confirmada'
                              : `Pedido reabierto: ${entry.status || 'sin estado'}`}
                          </li>
                        ))}
                      </ul>
                    </details>
                  )}

                  <p className="mb-1">
                    <strong>Técnica:</strong>{' '}
                    {order.technique || 'No definida'}
                  </p>

                  <div className="bg-light border rounded p-2 mb-2">
                    <div className="d-flex flex-wrap gap-2 justify-content-between mb-2">
                      <strong>Total cotizado: Q{payment.total.toFixed(2)}</strong>
                      <span className={`badge ${payment.badge}`}>
                        {payment.label}
                      </span>
                    </div>
                    <div className="d-flex flex-wrap gap-3 small mb-2">
                      <span><strong>Anticipo / pago inicial:</strong> Q{payment.initial.toFixed(2)}</span>
                      <span><strong>Pago final:</strong> Q{payment.final.toFixed(2)}</span>
                      <span><strong>Total pagado:</strong> Q{payment.paid.toFixed(2)}</span>
                      <span className={payment.balance > 0 ? 'text-danger' : 'text-success'}>
                        <strong>Saldo pendiente: Q{payment.balance.toFixed(2)}</strong>
                      </span>
                    </div>

                    {!isCancelled && !isDelivered && (
                      <div className="d-flex align-items-center gap-2">
                        <label className="small mb-0">
                          <strong>Forma de pago:</strong>
                        </label>
                        <select
                          className="form-select form-select-sm history-payment-plan-select"
                          value={order.paymentPlan || 'anticipo_50'}
                          onChange={(event) =>
                            handleChangePaymentPlan(order, event.target.value)
                          }
                        >
                          <option value="anticipo_50">Anticipo 50%</option>
                          <option value="completo">Pago completo</option>
                        </select>
                      </div>
                    )}
                  </div>


                  <p className="mb-1">
                    <strong>Estado:</strong>{' '}
                    <span
                      className={
                        getStatusBadge(order.status).className
                      }
                    >
                      {getStatusBadge(order.status).label}
                    </span>
                  </p>

                  {isCancelled && (
                    <p className="mb-1 text-danger">
                      <strong>Motivo de anulación:</strong>{' '}
                      {order.cancelReason || 'No definido'}
                    </p>
                  )}

                  <div className="mt-3">
                    <label className="form-label">
                      Cambiar estado
                    </label>

                    <select
                      className="form-select"
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
                      <option value="en_arreglo">
                        En arreglo / devolución
                      </option>
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

                  <div className="mt-3 d-flex flex-wrap gap-2 align-items-center">
                    <button
                      className="btn btn-outline-primary"
                      onClick={() =>
                        handleDownloadOrderPDF(order)
                      }
                    >
                      Descargar cotización
                    </button>

                    <a
                      href={generateWhatsAppLink(order)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-success"
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
                      Editar
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

                    

                    {isAdmin && (
                      <button
                        className="btn btn-outline-danger"
                        onClick={() =>
                          handleDeleteOrder(order)
                        }
                      >
                        Eliminar
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