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

  const pendientes = orders.filter(
    (o) => o.status === 'pendiente_aprobacion'
  ).length

  const aprobados = orders.filter(
    (o) => o.status === 'aprobado'
  ).length

  const produccion = orders.filter(
    (o) => o.status === 'en_produccion'
  ).length

  const terminados = orders.filter(
    (o) => o.status === 'terminado'
  ).length

  const entregados = orders.filter(
    (o) => o.status === 'entregado'
  ).length

  const anulados = orders.filter(
    (o) => o.status === 'anulado'
  ).length
  return (
    <div>
      <div className="mb-4">
        <h2 className="page-title">Dashboard</h2>
        <p className="page-subtitle">
          Resumen general del estado de los pedidos registrados.
        </p>
      </div>

      <div className="row g-3">
        <div className="col-12 col-md-6 col-xl-3">
          <div className="app-card p-4">
            <p className="text-muted mb-1">Total de pedidos</p>
            <h2 className="mb-0">{total}</h2>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="app-card p-4">
            <p className="text-muted mb-1">Pendientes</p>
            <h2 className="mb-0">{pendientes}</h2>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="app-card p-4">
            <p className="text-muted mb-1">Aprobados</p>
            <h2 className="mb-0">{aprobados}</h2>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="app-card p-4">
            <p className="text-muted mb-1">En producción</p>
            <h2 className="mb-0">{produccion}</h2>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="app-card p-4">
            <p className="text-muted mb-1">Terminados</p>
            <h2 className="mb-0">{terminados}</h2>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="app-card p-4">
            <p className="text-muted mb-1">Entregados</p>
            <h2 className="mb-0">{entregados}</h2>
          </div>
        </div>

        <div className="col-12 col-md-6 col-xl-3">
          <div className="app-card p-4">
            <p className="text-muted mb-1">Anulados</p>
            <h2 className="mb-0">{anulados}</h2>
          </div>
        </div>
      </div>
    </div>
  )
}

export default DashboardPage