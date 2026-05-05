import { db } from '../firebase/config'
import { collection, addDoc, getDocs, doc, updateDoc } from 'firebase/firestore'
import { storage } from '../firebase/config'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { useEffect } from 'react'
import GarmentEditor from '../components/GarmentEditor'
import { useState } from 'react'
import jsPDF from 'jspdf'

function CreateOrderPage() {
  const [orders, setOrders] = useState([])

  
  const loadOrders = async () => {
    try {
      const querySnapshot = await getDocs(collection(db, "orders"))

      const ordersData = querySnapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }))

      setOrders(ordersData)

    } catch (error) {
      console.error("Error cargando pedidos:", error)
    }
  }

  useEffect(() => {
    loadOrders()
  }, [])


  const handleSaveOrder = async (order) => {
    try {
      // 1. Crear referencia en storage
      const storageRef = ref(storage, `orders/${Date.now()}.png`)

      // 2. Subir imagen (base64)
      await uploadString(storageRef, order.previewImage, 'data_url')

      // 3. Obtener URL pública
      const downloadURL = await getDownloadURL(storageRef)

      // 4. Crear nuevo objeto con URL en lugar de base64
      const newOrder = {
        ...order,
        ...form, 
        previewImage: downloadURL,
        previewBase64: order.previewImage,
        status: 'pendiente_aprobacion'
      }

      // 5. Guardar en Firestore
      const docRef = await addDoc(collection(db, "orders"), newOrder)

      setOrders((prev) => [...prev, { ...newOrder, id: docRef.id }])

    } catch (error) {
      console.error("Error guardando pedido:", error)
    }
  }

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    product: '',
    size: '',
    quantity: 1,
    technique: ''
  })

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
      <h2>Crear Pedido Personalizado</h2>

      <div className="card p-3 mb-3">
        <h5>Datos del pedido</h5>

        <div className="row mb-3">
          <div className="col-md-6">
            <label>Nombre del cliente</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej. Carlos Pérez"
              value={form.customerName}
              onChange={(e) =>
                setForm({ ...form, customerName: e.target.value })
              }
            />
          </div>

          <div className="col-md-6">
            <label>Teléfono</label>
            <input
              type="text"
              className="form-control"
              placeholder="Ej. 5555-5555"
              value={form.phone}
              onChange={(e) =>
                setForm({ ...form, phone: e.target.value })
              }
            />
          </div>
        </div>

        <div className="row">
          <div className="col-md-3">
            <label>Prenda</label>
            <select
              className="form-control"
              value={form.product}
              onChange={(e) =>
                setForm({ ...form, product: e.target.value })
              }
            >
              <option value="">Seleccione</option>
              <option>Playera</option>
              <option>Sudadero</option>
              <option>Gorra</option>
            </select>
          </div>

          <div className="col-md-3">
            <label>Talla</label>
            <select
              className="form-control"
              value={form.size}
              onChange={(e) =>
                setForm({ ...form, size: e.target.value })
              }
            >
              <option value="">Seleccione</option>
              <option>S</option>
              <option>M</option>
              <option>L</option>
            </select>
          </div>

          <div className="col-md-3">
            <label>Cantidad</label>
            <input
              type="number"
              className="form-control"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: e.target.value })
              }
            />
          </div>

          <div className="col-md-3">
            <label>Técnica</label>
            <select
              className="form-control"
              value={form.technique}
              onChange={(e) =>
                setForm({ ...form, technique: e.target.value })
              }
            >
              <option value="">Seleccione</option>
              <option>DTF</option>
              <option>Bordado</option>
              <option>Sublimación</option>
            </select>
          </div>
        </div>
      </div>

      <GarmentEditor onSave={handleSaveOrder} />

      <hr />

      <h4>Pedidos guardados</h4>

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

export default CreateOrderPage