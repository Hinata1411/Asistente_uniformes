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
        previewImage: downloadURL,
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
                  <strong>Talla:</strong> {o.size || 'No definida'}
                </p>

                <p className="mb-1">
                  <strong>Cantidad:</strong> {o.quantity || 0}
                </p>

                <p className="mb-1">
                  <strong>Técnica:</strong> {o.technique || 'No definida'}
                </p>

                <p className="mb-1">
                  <strong>Estado:</strong>{' '}
                    <span className="badge bg-warning text-dark">
                      {o.status || 'pendiente_aprobacion'}
                    </span>
                </p>
              </div>
            </div>
          </div>
        </div>
      ))}
    </div>
  )
}

export default CreateOrderPage