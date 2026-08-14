import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function PrivateRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return (
      <p className="text-center mt-5">
        Cargando...
      </p>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return (
      <div className="container mt-5 text-center">
        <div className="alert alert-danger">
          No tienes permisos para acceder a esta sección.
        </div>
      </div>
    )
  }

  return children
}

export default PrivateRoute