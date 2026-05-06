import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase/config'
import { useAuth } from './context/AuthContext'

import CreateOrderPage from './pages/CreateOrderPage'
import OrdersHistoryPage from './pages/OrdersHistoryPage'
import LoginPage from './pages/LoginPage'
import PrivateRoute from './components/PrivateRoute'
import DashboardPage from './pages/DashboardPage'

function AppContent() {
  const {user, role } = useAuth()
  const location = useLocation()

  useEffect(() => {
    const unsubscribe = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser)
    })

    return () => unsubscribe()
  }, [])

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error cerrando sesión:', error)
    }
  }

  return (
    <>
      {user && location.pathname !== '/login' && (
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4 shadow-sm">
          <Link className="navbar-brand fw-bold" to="/crearpedido">
            🎽 Asistente Uniformes
          </Link>

          <div className="navbar-nav me-auto">
            <Link className="nav-link" to="/crearpedido">
              Crear pedido
            </Link>

            {role === 'admin' && (
              <>
                <Link className="nav-link" to="/historial">
                  Historial
                </Link>

                <Link className="nav-link" to="/dashboard">
                  Dashboard
                </Link>
              </>
            )}
          </div>

          <span className="text-white me-3 small">
            {user?.email}
          </span>

          <button
            className="btn btn-outline-light btn-sm"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/dashboard"
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <DashboardPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/crearpedido"
          element={
            <PrivateRoute allowedRoles={['admin', 'empleado']}>
              <CreateOrderPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/historial"
          element={
            <PrivateRoute allowedRoles={['admin']}>
              <OrdersHistoryPage />
            </PrivateRoute>
          }
        />

        <Route path="*" element={<LoginPage />} />
      </Routes>
    </>
  )
}

function App() {
  return (
    <BrowserRouter>
      <AppContent />
    </BrowserRouter>
  )
}

export default App