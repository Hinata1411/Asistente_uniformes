import { BrowserRouter, Routes, Route, Link, useLocation } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { onAuthStateChanged, signOut } from 'firebase/auth'
import { auth } from './firebase/config'

import CreateOrderPage from './pages/CreateOrderPage'
import OrdersHistoryPage from './pages/OrdersHistoryPage'
import LoginPage from './pages/LoginPage'
import PrivateRoute from './components/PrivateRoute'

function AppContent() {
  const [user, setUser] = useState(null)
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
        <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4">
          <Link className="navbar-brand" to="/crearpedido">
            Asistente Uniformes
          </Link>

          <div className="navbar-nav">
            <Link className="nav-link" to="/crearpedido">
              Crear pedido
            </Link>

            <Link className="nav-link" to="/historial">
              Historial
            </Link>
          </div>

          <button
            className="btn btn-outline-light"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </nav>
      )}

      <Routes>
        <Route path="/login" element={<LoginPage />} />

        <Route
          path="/crearpedido"
          element={
            <PrivateRoute user={user}>
              <CreateOrderPage />
            </PrivateRoute>
          }
        />

        <Route
          path="/historial"
          element={
            <PrivateRoute user={user}>
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