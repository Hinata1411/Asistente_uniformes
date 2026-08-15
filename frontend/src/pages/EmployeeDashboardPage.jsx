import { useEffect, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { Link } from 'react-router-dom'

import { db } from '../firebase/config'

function EmployeeDashboardPage() {
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

  const pendingOrders = orders.filter(
    (order) =>
      order.status === 'pendiente_aprobacion' ||
      order.status === 'aprobado'
  )

  const productionOrders = orders.filter(
    (order) =>
      order.status === 'en_produccion'
  )

  const finishedOrders = orders.filter(
    (order) =>
      order.status === 'terminado'
  )

  const recentOrders = [...orders]
  .sort((a, b) => {
    const dateA = new Date(a.createdAt || 0)
    const dateB = new Date(b.createdAt || 0)

    return dateB - dateA
  })
  .slice(0, 5)

  if (loading) {
    return (
      <div className="container py-4">
        Cargando información...
      </div>
    )
  }

  return (
    <div className="container py-4">
      <div className="mb-4">
        <h2>Panel operativo</h2>

        <p className="text-muted">
          Consulta los pedidos que requieren atención
          y accede rápidamente a las tareas del día.
        </p>
      </div>

      <div className="row g-3 mb-4">
        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-muted">
                Pendientes
              </span>

              <h2 className="mt-2">
                {pendingOrders.length}
              </h2>

              <p className="mb-0">
                Pedidos pendientes de aprobación o inicio.
              </p>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-muted">
                En producción
              </span>

              <h2 className="mt-2">
                {productionOrders.length}
              </h2>

              <p className="mb-0">
                Pedidos que se encuentran en proceso.
              </p>
            </div>
          </div>
        </div>

        <div className="col-12 col-md-4">
          <div className="card shadow-sm border-0 h-100">
            <div className="card-body">
              <span className="text-muted">
                Terminados
              </span>

              <h2 className="mt-2">
                {finishedOrders.length}
              </h2>

              <p className="mb-0">
                Pedidos listos para continuar con entrega.
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="card shadow-sm border-0">
        <div className="card-body">
          <h4 className="mb-3">
            Acciones rápidas
          </h4>

        <div className="card shadow-sm border-0 mt-4">
          <div className="card-body">
            <div className="d-flex justify-content-between align-items-center mb-3">
              <div>
                <h4 className="mb-1">
                  Pedidos recientes
                </h4>

                <p className="text-muted mb-0">
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
                <table className="table align-middle mb-0">
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
                          {order.productName ||
                            order.product ||
                            order.productType ||
                            'No definida'}
                        </td>

                        <td>
                          {order.technique || 'No definida'}
                        </td>

                        <td>
                          <span className="badge bg-secondary">
                            {order.status || 'pendiente_aprobacion'}
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

          <div className="d-flex flex-wrap gap-2">
            <Link
              to="/crearpedido"
              className="btn btn-primary"
            >
              Crear pedido
            </Link>

            <Link
              to="/historial"
              className="btn btn-outline-primary"
            >
              Consultar pedidos
            </Link>
          </div>
        </div>
      </div>
    </div>
  )
}

export default EmployeeDashboardPage