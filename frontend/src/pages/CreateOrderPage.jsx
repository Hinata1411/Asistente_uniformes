import { db, storage } from '../firebase/config'
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import GarmentEditor from '../components/GarmentEditor'

function CreateOrderPage() {
  const location = useLocation()

  const [editingOrder, setEditingOrder] = useState(null)
  const [aiResult, setAiResult] = useState('')

  const [form, setForm] = useState({
    customerName: '',
    phone: '',
    product: '',
    size: '',
    quantity: 1,
    technique: ''
  })

  useEffect(() => {
    if (location.state?.orderToEdit) {
      const order = location.state.orderToEdit

      setForm({
        customerName: order.customerName || '',
        phone: order.phone || '',
        product: order.product || '',
        size: order.size || '',
        quantity: order.quantity || 1,
        technique: order.technique || ''
      })

      setEditingOrder(order)
      window.scrollTo(0, 0)
    }
  }, [location.state])

  const resetForm = () => {
    setForm({
      customerName: '',
      phone: '',
      product: '',
      size: '',
      quantity: 1,
      technique: ''
    })
  }

  const handleSaveOrder = async (order) => {
    try {
      if (editingOrder) {
        const updatedOrder = {
          ...editingOrder,
          ...form
        }

        await updateDoc(doc(db, 'orders', editingOrder.id), updatedOrder)

        setEditingOrder(null)
        resetForm()

        alert('Pedido actualizado correctamente')
        return
      }

      const previewPath = `orders/${Date.now()}.png`
      const storageRef = ref(storage, previewPath)

      await uploadString(storageRef, order.previewImage, 'data_url')

      const previewImageUrl = await getDownloadURL(storageRef)

      const newOrder = {
        ...order,
        ...form,
        previewImage: previewImageUrl,
        previewBase64: order.previewImage,
        previewPath,
        status: 'pendiente_aprobacion',
        createdAt: new Date().toISOString()
      }

      await addDoc(collection(db, 'orders'), newOrder)

      resetForm()

      alert('Pedido guardado correctamente')
    } catch (error) {
      console.error('Error guardando pedido:', error)
      alert('Ocurrió un error al guardar el pedido')
    }
  }

  const handleGenerateAI = async () => {
    try {
      const response = await fetch('http://localhost:3001/api/ai/recommendation', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json'
        },
        body: JSON.stringify({
          product: form.product,
          technique: form.technique,
          quantity: form.quantity
        })
      })

      const data = await response.json()
      setAiResult(data.result)

    } catch (error) {
      console.error(error)
      alert('Error con IA')
    }
  }

  return (
    <div className="container mt-4">
      <h2>
        {editingOrder ? 'Editar Pedido' : 'Crear Pedido Personalizado'}
      </h2>

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
              min="1"
              value={form.quantity}
              onChange={(e) =>
                setForm({ ...form, quantity: Number(e.target.value) })
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

          <button
            className="btn btn-dark mt-3"
            onClick={handleGenerateAI}
          >
            Generar recomendación IA
          </button>
        </div>
      </div>

      {editingOrder && (
        <div className="alert alert-warning">
          Estás editando datos del pedido. La imagen del diseño no se modifica en esta versión.
        </div>
      )}

      {aiResult && (
        <div className="alert alert-info mt-3">
          <strong>IA:</strong>
          <pre style={{ whiteSpace: 'pre-wrap' }}>
            {aiResult}
          </pre>
        </div>
      )}

      <GarmentEditor onSave={handleSaveOrder} />
    </div>
  )
}

export default CreateOrderPage