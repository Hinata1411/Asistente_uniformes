import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'

function DashboardPage() {
  const [orders, setOrders] = useState([])

  const loadOrders = async () => {
    const querySnapshot = await getDocs(collection(db, 'orders'))

    const ordersData = querySnapshot.docs.map((doc) => ({
      id: doc.id,
      ...doc.data()
    }))

    setOrders(ordersData)
  }

  useEffect(() => {
    loadOrders()
  }, [])

  const total = orders.length
  const pendientes = orders.filter((o) => o.status === 'pendiente_aprobacion').length
  const produccion = orders.filter((o) => o.status === 'en_produccion').length
  const entregados = orders.filter((o) => o.status === 'entregado').length
  const anulados = orders.filter((o) => o.status === 'anulado').length

  return (
    <div className="container mt-4">
      <h2>Dashboard</h2>

      <div className="row mt-3">
        <div className="col-md-3 mb-3">
          <div className="card p-3 shadow-sm text-white bg-primary">
            <h6>Total pedidos</h6>
            <h2>{total}</h2>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card p-3 shadow-sm text-white bg-warning">
            <h6>Pendientes</h6>
            <h2>{pendientes}</h2>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card p-3 shadow-sm text-white bg-info">
            <h6>En producción</h6>
            <h2>{produccion}</h2>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card p-3 shadow-sm text-white bg-success">
            <h6>Entregados</h6>
            <h2>{entregados}</h2>
          </div>
        </div>

        <div className="col-md-3 mb-3">
          <div className="card p-3 shadow-sm text-white bg-danger">
            <h6>Anulados</h6>
            <h2>{anulados}</h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage