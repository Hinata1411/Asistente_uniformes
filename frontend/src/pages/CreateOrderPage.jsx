import GarmentEditor from '../components/GarmentEditor'
import { useState } from 'react'

function CreateOrderPage() {
  const [orders, setOrders] = useState([])

  const handleSaveOrder = (order) => {
    setOrders((prev) => [...prev, order])
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