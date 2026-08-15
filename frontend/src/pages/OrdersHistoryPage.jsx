import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { db } from '../firebase/config'
import {
  collection,
  getDocs,
  doc,
  updateDoc
} from 'firebase/firestore'
import jsPDF from 'jspdf'
import OrderAIValidationDetails from '../components/OrderAIValidationDetails'

function OrdersHistoryPage() {
  const [orders, setOrders] = useState([])
  const navigate = useNavigate()
  const [search, setSearch] = useState('')
  const [statusFilter, setStatusFilter] = useState('')

  const loadOrders = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, 'orders'))

      const ordersData = querySnapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data()
      }))

      setOrders(ordersData)
    } catch (error) {
      console.error('Error cargando pedidos:', error)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const getAssistantRecommendation = (order) => {
    if (order.technique === 'DTF') {
      return 'Recomendado para diseños con varios colores y detalles.'
    }

    if (order.technique === 'Bordado') {
      return 'Ideal para logos pequeños, uniformes y acabados profesionales.'
    }

    if (order.technique === 'Sublimación') {
      return 'Ideal para prendas claras o diseños completos.'
    }

    return 'Seleccione una técnica para recibir recomendación.'
  }

  const handleChangeStatus = async (orderId, newStatus) => {
    try {
      await updateDoc(doc(db, 'orders', orderId), {
        status: newStatus
      })

      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId
            ? { ...order, status: newStatus }
            : order
        )
      )
    } catch (error) {
      console.error('Error actualizando estado:', error)
    }
  }

  const handleCancelOrder = async (order) => {
    const reason = window.prompt('Motivo de anulación del pedido:')

    if (!reason) return

    const cancelledAt = new Date().toISOString()

    try {
      await updateDoc(doc(db, 'orders', order.id), {
        status: 'anulado',
        cancelReason: reason,
        cancelledAt
      })

      setOrders((prev) =>
        prev.map((item) =>
          item.id === order.id
            ? {
                ...item,
                status: 'anulado',
                cancelReason: reason,
                cancelledAt
              }
            : item
        )
      )
    } catch (error) {
      console.error('Error anulando pedido:', error)
    }
  }

  const generateWhatsAppLink = (order) => {
    const message = `
      Hola ${order.customerName || ''},

      Tu pedido está en estado: ${order.status || 'pendiente_aprobacion'}

      Detalle:
      Prenda: ${order.product || 'No definida'}
      Talla: ${order.size || 'No definida'}
      Cantidad: ${order.quantity || 0}
      Técnica: ${order.technique || 'No definida'}

      Vista previa:
      ${order.previewImage || 'No disponible'}
          `

    const encodedMessage = encodeURIComponent(message)
    return `https://wa.me/502${order.phone}?text=${encodedMessage}`
  }

  const handleDownloadOrderPDF = (order) => {
    const docPDF = new jsPDF()

    docPDF.setFontSize(18)
    docPDF.text('Pedido personalizado', 20, 20)

    docPDF.setFontSize(12)
    docPDF.text(`Cliente: ${order.customerName || 'No definido'}`, 20, 40)
    docPDF.text(`Teléfono: ${order.phone || 'No definido'}`, 20, 50)
    docPDF.text(`Prenda: ${order.product || 'No definida'}`, 20, 60)
    docPDF.text(`Talla: ${order.size || 'No definida'}`, 20, 70)
    docPDF.text(`Cantidad: ${order.quantity || 0}`, 20, 80)
    docPDF.text(`Técnica: ${order.technique || 'No definida'}`, 20, 90)
    docPDF.text(`Estado: ${order.status || 'pendiente_aprobacion'}`, 20, 100)

    docPDF.text('Recomendación del asistente:', 20, 115)
    docPDF.text(getAssistantRecommendation(order), 20, 125, {
      maxWidth: 170
    })

    if (order.previewBase64) {
      docPDF.text('Vista previa:', 20, 145)

      docPDF.addImage(
        order.previewBase64,
        'PNG',
        20,
        155,
        80,
        95
      )
    } else {
      docPDF.text('Vista previa no disponible para este pedido.', 20, 145)
    }

    if (order.status === 'anulado') {
      docPDF.text(`Motivo de anulación: ${order.cancelReason || 'No definido'}`, 20, 260, {
        maxWidth: 170
      })
    }

    docPDF.save(`pedido-${order.customerName || 'cliente'}.pdf`)
  }

  const filteredOrders = orders.filter((o) => {
      const matchesSearch =
        o.customerName?.toLowerCase().includes(search.toLowerCase()) ||
        o.product?.toLowerCase().includes(search.toLowerCase())

      const matchesStatus =
        statusFilter === '' || o.status === statusFilter

      return matchesSearch && matchesStatus
    })

  return (
    <div className="container mt-4">
      <h2>Historial de pedidos</h2>

      {orders.length === 0 && (
        <p className="text-muted">No hay pedidos registrados.</p>
      )}

      <div className="card p-3 mb-3">
        <div className="row">

          <div className="col-md-6">
            <input
              type="text"
              className="form-control"
              placeholder="Buscar por cliente o prenda..."
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
          </div>

          <div className="col-md-6">
            <select
              className="form-control"
              value={statusFilter}
              onChange={(e) => setStatusFilter(e.target.value)}
            >
              <option value="">Todos los estados</option>
              <option value="pendiente_aprobacion">Pendiente</option>
              <option value="aprobado">Aprobado</option>
              <option value="en_produccion">Producción</option>
              <option value="terminado">Terminado</option>
              <option value="entregado">Entregado</option>
              <option value="anulado">Anulado</option>
            </select>
          </div>

        </div>
      </div>

      {filteredOrders.map((o) => {
        const isCancelled = o.status === 'anulado'

        return (
          <div
            key={o.id}
            className={`card mb-3 shadow-sm border-0 ${
              isCancelled ? 'bg-light border-danger' : ''
            }`}
                      >
            <div className="row g-0">
              <div className="col-md-3 p-2">
                <img
                  src={o.previewImage}
                  className="img-fluid rounded"
                  alt="Vista previa del pedido"
                />
              </div>

              <div className="col-md-9">
                <div className="card-body">
                  <h5 className="card-title">
                    {o.product || 'Sin prenda seleccionada'}
                  </h5>

                  <p className="mb-1">
                    <strong>Cliente:</strong> {o.customerName || 'No definido'}
                  </p>

                  <p className="mb-1">
                    <strong>Teléfono:</strong> {o.phone || 'No definido'}
                  </p>

                  <p className="mb-1">
                    <strong>Talla:</strong> {o.size || 'No definida'}
                  </p>

                  <p className="mb-1">
                    <strong>Cantidad:</strong> {o.quantity || 0}
                  </p>

                  <p className="mb-1">
                    <strong>Técnica:</strong> {o.technique || 'No definida'}
                  </p>

                  <OrderAIValidationDetails
                    validation={o.aiValidation}
                    validatedAt={o.aiValidatedAt}
                  />

                  <p className="mb-1">
                    <strong>Estado:</strong>{' '}
                    <span className={`badge ${
                      o.status === 'anulado' ? 'bg-danger' :
                      o.status === 'entregado' ? 'bg-success' :
                      o.status === 'en_produccion' ? 'bg-primary' :
                      'bg-warning text-dark'
                    }`}>
                      {o.status || 'pendiente_aprobacion'}
                    </span>
                  </p>

                  {isCancelled && (
                    <p className="mb-1 text-danger">
                      <strong>Motivo de anulación:</strong>{' '}
                      {o.cancelReason || 'No definido'}
                    </p>
                  )}

                  <div className="mt-3">
                    <label className="form-label">Cambiar estado</label>
                    <select
                      className="form-select"
                      value={o.status || 'pendiente_aprobacion'}
                      disabled={isCancelled}
                      onChange={(e) =>
                        handleChangeStatus(o.id, e.target.value)
                      }
                    >
                      <option value="pendiente_aprobacion">
                        Pendiente de aprobación
                      </option>
                      <option value="aprobado">Aprobado</option>
                      <option value="en_produccion">En producción</option>
                      <option value="terminado">Terminado</option>
                      <option value="entregado">Entregado</option>
                      <option value="anulado">Anulado</option>
                    </select>
                  </div>

                  <div className="mt-3 d-flex flex-wrap gap-2 align-items-center">
                    <button
                      className="btn btn-outline-primary"
                      onClick={() => handleDownloadOrderPDF(o)}
                    >
                      Descargar pedido PDF
                    </button>

                    <a
                      href={generateWhatsAppLink(o)}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-success"
                      style={
                        isCancelled
                          ? { pointerEvents: 'none', opacity: 0.5 }
                          : {}
                      }
                    >
                      Enviar por WhatsApp
                    </a>

                    <button
                      className="btn btn-warning"
                      onClick={() =>
                        navigate('/crearpedido', { state: { orderToEdit: o } })
                      }
                      disabled={isCancelled}
                    >
                      Editar datos
                    </button>

                    <button
                      className="btn btn-danger"
                      onClick={() => handleCancelOrder(o)}
                      disabled={isCancelled}
                    >
                      Anular
                    </button>
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