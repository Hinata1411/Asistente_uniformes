import { db } from '../firebase/config'
import { collection, addDoc } from 'firebase/firestore'
import { storage } from '../firebase/config'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import GarmentEditor from '../components/GarmentEditor'
import { useState } from 'react'

function CreateOrderPage() {
  const [orders, setOrders] = useState([])

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
        previewImage: downloadURL
      }

      // 5. Guardar en Firestore
      const docRef = await addDoc(collection(db, "orders"), newOrder)

      console.log("Pedido guardado con imagen:", docRef.id)

      setOrders((prev) => [...prev, { ...newOrder, id: docRef.id }])

    } catch (error) {
      console.error("Error guardando pedido:", error)
    }
  }

  return (
    <div className="container mt-4">
      <h2>Crear Pedido Personalizado</h2>

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