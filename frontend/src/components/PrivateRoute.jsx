import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function PrivateRoute({
  children,
  allowedRoles = []
}) {
  const {
    user,
    role,
    loading
  } = useAuth()

  if (loading) {
    return (
      <div className="container py-5 text-center">
        <div
          className="spinner-border text-warning"
          role="status"
        >
          <span className="visually-hidden">
            Cargando...
          </span>
        </div>

        <p className="mt-3">
          Verificando permisos...
        </p>
      </div>
    )
  }

  if (!user) {
    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  const hasPermission =
    allowedRoles.length === 0 ||
    allowedRoles.includes(role)

  if (!hasPermission) {
    /*
      Cada usuario es enviado a su propia
      página de inicio.
    */
    if (role === 'admin') {
      return (
        <Navigate
          to="/dashboard"
          replace
        />
      )
    }

    if (role === 'empleado') {
      return (
        <Navigate
          to="/empleado"
          replace
        />
      )
    }

    return (
      <Navigate
        to="/login"
        replace
      />
    )
  }

  return children
}

export default PrivateRoute