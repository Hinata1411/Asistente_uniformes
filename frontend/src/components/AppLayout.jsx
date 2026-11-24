import { useEffect, useState } from 'react'
import { Link, useLocation } from 'react-router-dom'
import { signOut } from 'firebase/auth'
import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import useSessionTimeout from '../hooks/useSessionTimeout'
import logo from '../assets/brand/arte-grafia-logo.png'
import '../styles/AppLayout.css'

const DESKTOP_QUERY = '(min-width: 992px)'

function CatalogIcon() {
  return (
    <span className="sidebar-icon" aria-hidden="true">
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
        <path d="M12 6c-3-2-6-2-9-1v14c3-1 6-1 9 1 3-2 6-2 9-1V5c-3-1-6-1-9 1Zm0 0v14" />
      </svg>
    </span>
  )
}

function AppLayout({ children }) {
  const { user, role } = useAuth()
  const location = useLocation()

  const [isDesktop, setIsDesktop] = useState(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(DESKTOP_QUERY).matches
  )

  // En escritorio la barra inicia abierta; en móvil, cerrada.
  const [sidebarOpen, setSidebarOpen] = useState(isDesktop)

  useSessionTimeout({
    timeoutMinutes: 30,
    warningMinutes: 15
  })

  useEffect(() => {
    const mql = window.matchMedia(DESKTOP_QUERY)

    const handleChange = (e) => {
      setIsDesktop(e.matches)
      setSidebarOpen(e.matches)
    }

    mql.addEventListener('change', handleChange)

    return () => mql.removeEventListener('change', handleChange)
  }, [])

  // En móvil, cerrar la barra automáticamente al tocar un link del menú.
  const handleNavClick = () => {
    if (!isDesktop) {
      setSidebarOpen(false)
    }
  }

  const handleLogout = async () => {
    try {
      await signOut(auth)
    } catch (error) {
      console.error('Error cerrando sesión:', error)
    }
  }

  const toggleSidebar = () => setSidebarOpen((prev) => !prev)

  const isActive = (path) => location.pathname === path

  const sidebarClassName = [
    'app-sidebar',
    isDesktop && !sidebarOpen ? 'is-collapsed' : '',
    !isDesktop && sidebarOpen ? 'is-open-mobile' : ''
  ]
    .filter(Boolean)
    .join(' ')

  const toggleClassName = [
    'sidebar-toggle',
    isDesktop
      ? sidebarOpen
        ? 'toggle-desktop-open'
        : 'toggle-desktop-collapsed'
      : sidebarOpen
        ? 'toggle-mobile-open'
        : 'toggle-mobile-closed'
  ].join(' ')

  return (
    <div className="app-layout">
      {!isDesktop && sidebarOpen && (
        <div
          className="sidebar-overlay"
          onClick={() => setSidebarOpen(false)}
        />
      )}

      <button
        type="button"
        className={toggleClassName}
        aria-label="Mostrar u ocultar menú"
        aria-expanded={sidebarOpen}
        onClick={toggleSidebar}
      >
        <span className={`toggle-arrow ${sidebarOpen ? 'is-open' : ''}`} />
      </button>

      <aside className={sidebarClassName}>
        <div className="sidebar-brand">
          <img
            src={logo}
            alt="Arte Grafia"
            className="sidebar-logo-img"
          />

          <div className="sidebar-brand-text">
            <h4>Asistente</h4>
            <span>Uniformes</span>
          </div>
        </div>

        <nav className="sidebar-menu" onClick={handleNavClick}>
          {role === 'admin' && (
            <>
              <Link
                to="/dashboard"
                className={`sidebar-link ${
                  isActive('/dashboard') ? 'active' : ''
                }`}
              >
                <span className="sidebar-icon">⌂</span>
                <span className="sidebar-label">Inicio</span>
              </Link>

              <div className="sidebar-section-title">Pedidos</div>

              <Link
                to="/crearpedido"
                className={`sidebar-link ${
                  isActive('/crearpedido') ? 'active' : ''
                }`}
              >
                <span className="sidebar-icon">＋</span>
                <span className="sidebar-label">Crear pedido</span>
              </Link>

              <Link
                to="/historial"
                className={`sidebar-link ${
                  isActive('/historial') ? 'active' : ''
                }`}
              >
                <span className="sidebar-icon">▤</span>
                <span className="sidebar-label">Historial</span>
              </Link>

              <Link
                to="/catalogos"
                className={`sidebar-link ${isActive('/catalogos') ? 'active' : ''}`}
              >
                <CatalogIcon />
                <span className="sidebar-label">Catálogos</span>
              </Link>

              <Link
                to="/productos"
                className={`sidebar-link ${
                  isActive('/productos') ? 'active' : ''
                }`}
              >
                <span className="sidebar-icon">▦</span>
                <span className="sidebar-label">Inventario</span>
              </Link>

              <div className="sidebar-section-title">Registros</div>

              <Link
                to="/gastos"
                className={`sidebar-link ${isActive('/gastos') ? 'active' : ''}`}
              >
                <span className="sidebar-icon" aria-hidden="true">Q</span>
                <span className="sidebar-label">Gastos</span>
              </Link>

              <Link
                to="/graficas"
                className={`sidebar-link ${isActive('/graficas') ? 'active' : ''}`}
              >
                <span className="sidebar-icon" aria-hidden="true">
                  <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M4 4v16h16M8 16v-4m5 4V8m5 8V5" />
                  </svg>
                </span>
                <span className="sidebar-label">Gráficas</span>
              </Link>
            </>
          )}

          {role === 'empleado' && (
            <>
              <Link
                to="/empleado"
                className={`sidebar-link ${
                  isActive('/empleado') ? 'active' : ''
                }`}
              >
                <span className="sidebar-icon">⌂</span>
                <span className="sidebar-label">Inicio</span>
              </Link>

              <div className="sidebar-section-title">Operación</div>

              <Link
                to="/crearpedido"
                className={`sidebar-link ${
                  isActive('/crearpedido') ? 'active' : ''
                }`}
              >
                <span className="sidebar-icon">＋</span>
                <span className="sidebar-label">Crear pedido</span>
              </Link>

              <Link
                to="/historial"
                className={`sidebar-link ${
                  isActive('/historial') ? 'active' : ''
                }`}
              >
                <span className="sidebar-icon">▤</span>
                <span className="sidebar-label">Pedidos</span>
              </Link>

              <Link
                to="/catalogos"
                className={`sidebar-link ${isActive('/catalogos') ? 'active' : ''}`}
              >
                <CatalogIcon />
                <span className="sidebar-label">Catálogos</span>
              </Link>
            </>
          )}
        </nav>

        <div className="sidebar-footer">
          <Link
            to="/perfil"
            onClick={handleNavClick}
            className={`sidebar-link ${
              isActive('/perfil') ? 'active' : ''
            }`}
          >
            <span className="sidebar-icon">⚙</span>

            <span className="sidebar-label">
              Mi perfil
            </span>
          </Link>
          <div className="sidebar-user">
            <div className="user-avatar">
              {user?.email?.charAt(0).toUpperCase()}
            </div>

            <div className="user-info">
              <span className="user-email">{user?.email}</span>

              <span className="user-role">
                {role === 'admin' ? 'Administrador' : 'Colaborador'}
              </span>
            </div>
          </div>

          <button className="sidebar-logout" onClick={handleLogout}>
            <span className="sidebar-label">Cerrar sesión</span>
            <span className="sidebar-icon sidebar-icon-only">⏻</span>
          </button>
        </div>
      </aside>

      <div className="app-main">
        <header className="app-header">
          <div className="header-left">
            <span className="header-label">
              Asistente de Personalización de Uniformes
            </span>
          </div>

          <div className="header-user">
            <span>{role === 'admin' ? 'Administrador' : 'Empleado'}</span>
          </div>
        </header>

        <main className="app-content">{children}</main>
      </div>
    </div>
  )
}

export default AppLayout
