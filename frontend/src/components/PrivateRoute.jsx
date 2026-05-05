import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

function PrivateRoute({ children, allowedRoles }) {
  const { user, role, loading } = useAuth()

  if (loading) {
    return <p className="text-center mt-5">Cargando...</p>
  }

  if (!user) {
    return <Navigate to="/login" />
  }

  if (allowedRoles && !allowedRoles.includes(role)) {
    return <Navigate to="/crearpedido" />
  }

  return children
}

export default PrivateRoute