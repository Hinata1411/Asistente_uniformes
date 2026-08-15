import { useEffect, useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const navigate = useNavigate()

  const {
    user,
    role,
    loading
  } = useAuth()

  useEffect(() => {
    if (loading) return

    if (!user || !role) return

    if (role === 'admin') {
      navigate('/dashboard', {
        replace: true
      })

      return
    }

    if (role === 'empleado') {
      navigate('/empleado', {
        replace: true
      })
    }
  }, [
    user,
    role,
    loading,
    navigate
  ])

  const handleLogin = async (e) => {
    e.preventDefault()

    try {
      setLoginLoading(true)

      await signInWithEmailAndPassword(
        auth,
        email,
        password
      )

      /*
        No hacemos navigate aquí.

        AuthContext detectará al usuario,
        consultará su rol en Firestore
        y el useEffect de arriba realizará
        la redirección correspondiente.
      */
    } catch (error) {
      console.error(
        'Error login:',
        error
      )

      alert('Credenciales incorrectas')
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <div
      className="container mt-5 d-flex justify-content-center align-items-center"
      style={{ minHeight: '80vh' }}
    >
      <div className="row justify-content-center w-100">
        <div className="col-md-4">
          <div className="card p-4 shadow-lg border-0">
            <h3 className="text-center mb-3">
              Iniciar sesión
            </h3>

            <form onSubmit={handleLogin}>
              <div className="mb-3">
                <label className="form-label">
                  Email
                </label>

                <input
                  type="email"
                  className="form-control"
                  value={email}
                  onChange={(e) =>
                    setEmail(e.target.value)
                  }
                  required
                />
              </div>

              <div className="mb-3">
                <label className="form-label">
                  Contraseña
                </label>

                <input
                  type="password"
                  className="form-control"
                  value={password}
                  onChange={(e) =>
                    setPassword(e.target.value)
                  }
                  required
                />
              </div>

              <button
                type="submit"
                className="btn btn-primary w-100"
                disabled={
                  loginLoading ||
                  loading
                }
              >
                {loginLoading
                  ? 'Ingresando...'
                  : 'Ingresar'}
              </button>
            </form>
          </div>
        </div>
      </div>
    </div>
  )
}

export default LoginPage