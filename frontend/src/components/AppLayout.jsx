import { Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import './AppLayout.css'

function AppLayout({ children }) {
  const { user, role } = useAuth()
  const location = useLocation()

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error cerrando sesión:', error)
    }
  }

  const isActive = (path) => location.pathname === path

  return (
    <div className="app-layout">
      <aside className="app-sidebar">
        <div className="sidebar-brand">
          <div className="sidebar-logo">🎽</div>

          <div>
            <h4>Asistente</h4>
            <span>Uniformes</span>
          </div>
        </div>

        <nav className="sidebar-menu">
          {role === 'admin' && (
            <Link
              to="/dashboard"
              className={`sidebar-link ${
                isActive('/dashboard') ? 'active' : ''
              }`}
            >
              <span className="sidebar-icon">⌂</span>
              Dashboard
            </Link>
          )}

          <div className="sidebar-section-title">
            Pedidos
          </div>

          <Link
            to="/crearpedido"
            className={`sidebar-link ${
              isActive('/crearpedido') ? 'active' : ''
            }`}
          >
            <span className="sidebar-icon">＋</span>
            Crear pedido
          </Link>

          {role === 'admin' && (
            <Link
              to="/historial"
              className={`sidebar-link ${
                isActive('/historial') ? 'active' : ''
              }`}
            >
              <span className="sidebar-icon">▤</span>
              Historial
            </Link>
          )}

          <Link
            to="/productos"
            className={`sidebar-link ${
              isActive('/productos') ? 'active' : ''
            }`}
          >
            <span className="sidebar-icon">▦</span>
            Productos
          </Link>
        </nav>

        <div className="sidebar-footer">
          <div className="sidebar-user">
            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase()}
            </div>

            <div className="user-info">
              <span className="user-email">
                {user?.email}
              </span>

              <span className="user-role">
                {role === 'admin'
                  ? 'Administrador'
                  : 'Empleado'}
              </span>
            </div>
          </div>

          <button
            className="sidebar-logout"
            onClick={handleLogout}
          >
            Cerrar sesión
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div>
            <span className="header-label">
              Asistente de Personalización de Uniformes
            </span>
          </div>

          <div className="header-user">
            <span>{role === 'admin' ? 'Administrador' : 'Empleado'}</span>
          </div>
        </header>

        <main className="app-content">
          {children}
        </main>
      </div>
    </div>
  )
}

export default AppLayout