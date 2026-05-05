import { useEffect, useState } from 'react'
import { db } from '../firebase/config'
import { collection, getDocs } from 'firebase/firestore'
import { useNavigate } from 'react-router-dom'

function OrdersHistoryPage() {

  const [orders, setOrders] = useState([])
  const navigate = useNavigate()

  const loadOrders = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "orders"))

      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setOrders(ordersData)
    } catch (error) {
      console.error(error)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const handleChangeStatus = async (orderId, newStatus) => {
    try {
      const orderRef = doc(db, "orders", orderId)

      await updateDoc(orderRef, {
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
      console.error("Error actualizando estado:", error)
    }
  }

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

  const handleDeleteOrder = async (order) => {
    const confirmDelete = window.confirm("¿Seguro que quieres eliminar este pedido?")

    if (!confirmDelete) return

    try {
      if (order.previewPath) {
        const imageRef = ref(storage, order.previewPath)
        await deleteObject(imageRef)
      }

      await deleteDoc(doc(db, "orders", order.id))

      setOrders((prev) =>
        prev.filter((item) => item.id !== order.id)
      )
    } catch (error) {
      console.error("Error eliminando pedido:", error)
    }
  }

  const generateWhatsAppLink = (order) => {
      const message = `
    Hola ${order.customerName},

    Tu pedido está en estado: ${order.status}

    Detalle:
    Prenda: ${order.product}
    Talla: ${order.size}
    Cantidad: ${order.quantity}
    Técnica: ${order.technique}

    Vista previa:
    ${order.previewImage}
      `

      const encodedMessage = encodeURIComponent(message)

      return `https://wa.me/502${order.phone}?text=${encodedMessage}`
    }


  const handleDownloadOrderPDF = async (order) => {
    const doc = new jsPDF()

    doc.setFontSize(18)
    doc.text('Pedido personalizado', 20, 20)

    doc.setFontSize(12)
    doc.text(`Cliente: ${order.customerName || 'No definido'}`, 20, 40)
    doc.text(`Teléfono: ${order.phone || 'No definido'}`, 20, 50)
    doc.text(`Prenda: ${order.product || 'No definida'}`, 20, 60)
    doc.text(`Talla: ${order.size || 'No definida'}`, 20, 70)
    doc.text(`Cantidad: ${order.quantity || 0}`, 20, 80)
    doc.text(`Técnica: ${order.technique || 'No definida'}`, 20, 90)
    doc.text(`Estado: ${order.status || 'pendiente_aprobacion'}`, 20, 100)

    doc.text('Recomendación del asistente:', 20, 115)
    doc.text(getAssistantRecommendation(order), 20, 125, {
      maxWidth: 170,
    })

    try {
      const imageBase64 = order.previewBase64
      doc.text('Vista previa:', 20, 145)

      doc.addImage(
        imageBase64,
        'PNG',
        20,
        155,
        80,
        95
      )
    } catch (error) {
      console.error('Error agregando imagen al PDF:', error)
      doc.text('No se pudo cargar la vista previa.', 20, 155)
    }

    doc.save(`pedido-${order.customerName || 'cliente'}.pdf`)
  }

  return (
    <div className="container mt-4">
      <h2>Historial de pedidos</h2>

      {orders.map((o, index) => (
        <div key={o.id} className="card mb-3 shadow-sm">
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

                <p className="mb-1">
                  <strong>Asistente:</strong> {getAssistantRecommendation(o)}
                </p>

                <p className="mb-1">
                  <strong>Estado:</strong>{' '}
                    <span className="badge bg-warning text-dark">
                      {o.status || 'pendiente_aprobacion'}
                    </span>
                </p>
                <div className="mt-3">
                  <label className="form-label">Cambiar estado</label>
                  <select
                    className="form-select"
                    value={o.status || 'pendiente_aprobacion'}
                    onChange={(e) => handleChangeStatus(o.id, e.target.value)}
                  >
                    <option value="pendiente_aprobacion">Pendiente de aprobación</option>
                    <option value="aprobado">Aprobado</option>
                    <option value="en_produccion">En producción</option>
                    <option value="terminado">Terminado</option>
                    <option value="entregado">Entregado</option>
                  </select>
                </div>


                <div className="mt-3">
                  <button
                    className="btn btn-warning ms-2"
                    onClick={() => navigate('/', { state: { orderToEdit: o } })}
                  >
                    Editar
                  </button>
                  <button
                    className="btn btn-danger ms-2"
                    onClick={() => handleDeleteOrder(o)}
                  >
                    Eliminar
                  </button>
                  <a
                    href={generateWhatsAppLink(o)}
                    target="_blank"
                    className="btn btn-success"
                  >
                    Enviar por WhatsApp
                  </a>
                  <button
                    className="btn btn-outline-primary me-2"
                    onClick={() => handleDownloadOrderPDF(o)}
                  >
                    Descargar pedido PDF
                  </button>
                </div>
              </div>
            </div>
          </div>
        </div>
      ))}

    </div>
  )
}

export default OrdersHistoryPage