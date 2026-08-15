import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'

import CreateOrderPage from './pages/CreateOrderPage'
import OrdersHistoryPage from './pages/OrdersHistoryPage'
import LoginPage from './pages/LoginPage'
import PrivateRoute from './components/PrivateRoute'
import DashboardPage from './pages/DashboardPage'
import AppLayout from './components/AppLayout'
import ProductsPage from './pages/ProductsPage'
import CreateProductPage from './pages/CreateProductPage'
import EmployeeDashboardPage from './pages/EmployeeDashboardPage'
import { useAuth } from './context/AuthContext'

function ProtectedLayout({ children, allowedRoles }) {
  return (
    <PrivateRoute allowedRoles={allowedRoles}>
      <AppLayout>
        {children}
      </AppLayout>
    </PrivateRoute>
  )
}

function RoleRedirect() {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <div className="container py-5 text-center">
        Cargando...
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (role === 'admin') {
    return <Navigate to="/dashboard" replace />
  }

  if (role === 'empleado') {
    return <Navigate to="/empleado" replace />
  }

  return <Navigate to="/login" replace />
}

function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <ProtectedLayout allowedRoles={['admin']}>
              <DashboardPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/empleado"
          element={
            <ProtectedLayout allowedRoles={['empleado']}>
              <EmployeeDashboardPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/crearpedido"
          element={
            <ProtectedLayout allowedRoles={['admin', 'empleado']}>
              <CreateOrderPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/historial"
          element={
            <ProtectedLayout allowedRoles={['admin', 'empleado']}>
              <OrdersHistoryPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/productos"
          element={
            <ProtectedLayout allowedRoles={['admin']}>
              <ProductsPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/productos/nuevo"
          element={
            <ProtectedLayout allowedRoles={['admin']}>
              <CreateProductPage />
            </ProtectedLayout>
          }
        />

        <Route
          path="/"
          element={<RoleRedirect />}
        />

        <Route
          path="*"
          element={<Navigate to="/login" replace />}
        />
      </Routes>
    </BrowserRouter>
  )
}

export default App