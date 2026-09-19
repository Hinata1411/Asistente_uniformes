import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { Link } from 'react-router-dom'

import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { getProductName, getStatusBadge } from '../services/orderFormatting'
import '../styles/statusBadges.css'
import '../styles/EmployeeDashboardPage.css'

// Mismo criterio de saludo que usa el panel de administración,
// para que ambas pantallas se sientan parte de la misma app.
const getGreeting = (hour) => {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

function EmployeeDashboardPage() {
  const { user } = useAuth()
  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadOrders = async () => {
      try {
        const snapshot = await getDocs(
          collection(db, 'orders')
        )

        const data = snapshot.docs.map((doc) => ({
          id: doc.id,
          ...doc.data()
        }))

        setOrders(data)
      } catch (error) {
        console.error(
          'Error cargando pedidos para empleado:',
          error
        )
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  const greeting = getGreeting(new Date().getHours())

  const displayName = user?.displayName?.trim()
    ? user.displayName.trim().split(' ')[0]
    : user?.email
      ? user.email.split('@')[0]
      : 'equipo'

  const pendingOrders = useMemo(
    () =>
      orders.filter(
        (order) =>
          order.status === 'pendiente_aprobacion' ||
          order.status === 'aprobado'
      ),
    [orders]
  )

  const productionOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === 'en_produccion'
      ),
    [orders]
  )

  const finishedOrders = useMemo(
    () =>
      orders.filter(
        (order) => order.status === 'terminado'
      ),
    [orders]
  )

  const recentOrders = useMemo(
    () =>
      [...orders]
        .sort((a, b) => {
          const dateA = new Date(a.createdAt || 0)
          const dateB = new Date(b.createdAt || 0)

          return dateB - dateA
        })
        .slice(0, 5),
    [orders]
  )

  if (loading) {
    return (
      <div className="employee-dashboard container py-4">
        Cargando información...
      </div>
    )
  }

  return (
    <div className="employee-dashboard container py-4">
      <div className="employee-header">
        <div>
          <h2 className="employee-greeting">
            {greeting}, {displayName}
          </h2>

          <p className="employee-subtitle">
            Consulta los pedidos que requieren atención
            y accede rápidamente a las tareas del día.
          </p>
        </div>

        <div className="employee-quick-actions">
          <Link
            to="/crearpedido"
            className="btn btn-primary"
          >
            + Crear pedido
          </Link>

        </div>
      </div>

      <div className="employee-stat-grid">
        <div className="employee-stat-card">
          <span className="employee-stat-label">
            Pendientes
          </span>

          <strong className="employee-stat-value">
            {pendingOrders.length}
          </strong>

          <p className="employee-stat-desc">
            Pedidos pendientes de aprobación o inicio.
          </p>
        </div>

        <div className="employee-stat-card employee-stat-card-dark">
          <span className="employee-stat-label">
            En producción
          </span>

          <strong className="employee-stat-value">
            {productionOrders.length}
          </strong>

          <p className="employee-stat-desc">
            Pedidos que se encuentran en proceso.
          </p>
        </div>

        <div className="employee-stat-card">
          <span className="employee-stat-label">
            Terminados
          </span>

          <strong className="employee-stat-value">
            {finishedOrders.length}
          </strong>

          <p className="employee-stat-desc">
            Pedidos listos para continuar con entrega.
          </p>
        </div>
      </div>

      <div className="employee-card">
        <div className="employee-card-heading">
          <div>
            <h4>Pedidos recientes</h4>

            <p>
              Consulta rápidamente los últimos pedidos registrados.
            </p>
          </div>

          <Link
            to="/historial"
            className="btn btn-outline-primary btn-sm"
          >
            Ver todos
          </Link>
        </div>

        {recentOrders.length === 0 ? (
          <p className="text-muted mb-0">
            No hay pedidos registrados.
          </p>
        ) : (
          <div className="table-responsive">
            <table className="table align-middle mb-0 employee-orders-table">
              <thead>
                <tr>
                  <th>Cliente</th>
                  <th>Prenda</th>
                  <th>Técnica</th>
                  <th>Estado</th>
                </tr>
              </thead>

              <tbody>
                {recentOrders.map((order) => (
                  <tr key={order.id}>
                    <td>
                      {order.customerName || 'No definido'}
                    </td>

                    <td>
                      {getProductName(order)}
                    </td>

                    <td>
                      {order.technique || 'No definida'}
                    </td>

                    <td>
                      <span
                        className={
                          getStatusBadge(order.status).className
                        }
                      >
                        {getStatusBadge(order.status).label}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  )
}

export default EmployeeDashboardPage