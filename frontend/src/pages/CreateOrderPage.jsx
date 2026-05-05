import { db } from '../firebase/config'
import { collection, addDoc } from 'firebase/firestore'
import { storage } from '../firebase/config'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { getDocs } from 'firebase/firestore'
import { useEffect } from 'react'
import GarmentEditor from '../components/GarmentEditor'
import { useState } from 'react'

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
        previewImage: downloadURL
      }

      // 5. Guardar en Firestore
      const docRef = await addDoc(collection(db, "orders"), newOrder)

      setOrders((prev) => [...prev, { ...newOrder, id: docRef.id }])

    } catch (error) {
      console.error("Error guardando pedido:", error)
    }
  }

  const [form, setForm] = useState({
    product: '',
    size: '',
    quantity: 1,
    technique: ''
  })

  return (
    <div className="container mt-4">
      <h2>Crear Pedido Personalizado</h2>

      <div className="card p-3 mb-3">
        <h5>Datos del pedido</h5>

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

      <h4>Pedidos guardados (local)</h4>

      {orders.map((o, index) => (
        <div key={index} className="card mb-3 p-2">
          <img src={o.previewImage} width={150} />
          <p className="mb-0">
            Posición: {o.logoPosition.x}, {o.logoPosition.y}
          </p>
        </div>
      ))}
    </div>
  )
}

export default CreateOrderPage