import { db } from '../firebase/config'
import { collection, addDoc, getDocs, doc, updateDoc, deleteDoc } from 'firebase/firestore'
import { storage } from '../firebase/config'
import { ref, uploadString, getDownloadURL, deleteObject } from 'firebase/storage'
import { useEffect } from 'react'
import GarmentEditor from '../components/GarmentEditor'
import { useState } from 'react'
import jsPDF from 'jspdf'
import { useLocation } from 'react-router-dom'

function CreateOrderPage() {
  const [orders, setOrders] = useState([])
  const [editingOrder, setEditingOrder] = useState(null)
  const location = useLocation()

  const handleSaveOrder = async (order) => {
    try {

      let previewImageUrl = order.previewImage
      let previewPath = order.previewPath

      // Solo subir imagen si es nueva
      if (!order.previewPath) {
        previewPath = `orders/${Date.now()}.png`
        const storageRef = ref(storage, previewPath)

        await uploadString(storageRef, order.previewImage, 'data_url')

        previewImageUrl = await getDownloadURL(storageRef)
      }

      const newOrder = {
        ...order,
        ...form,
        previewImage: previewImageUrl,
        previewBase64: order.previewImage,
        previewPath,
        status: editingOrder ? editingOrder.status : 'pendiente_aprobacion'
      }

      if (editingOrder) {
        const updatedOrder = {
          ...editingOrder,
          ...form,
        }

        await updateDoc(doc(db, "orders", editingOrder.id), updatedOrder)

        setOrders((prev) =>
          prev.map((item) =>
            item.id === editingOrder.id
              ? { ...updatedOrder, id: editingOrder.id }
              : item
          )
        )

        setEditingOrder(null)

        setForm({
          customerName: '',
          phone: '',
          product: '',
          size: '',
          quantity: 1,
          technique: ''
        })

        return
      }

      else {
        // CREATE
        const docRef = await addDoc(collection(db, "orders"), newOrder)

        setOrders((prev) => [...prev, { ...newOrder, id: docRef.id }])
      }

    } catch (error) {
      console.error(error)
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
    }
  }, [location.state])

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

    </div>
  )
}

export default CreateOrderPage