import { useEffect, useMemo, useState } from 'react'
import { signInWithEmailAndPassword } from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import logo from '../assets/brand/arte-grafia-logo.png'
import './LoginPage.css'

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [loginLoading, setLoginLoading] = useState(false)

  const navigate = useNavigate()

  const { user, role, loading } = useAuth()

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia('(prefers-reduced-motion: reduce)').matches,
    []
  )

  // Animación de bienvenida: logo centrado que se desvanece hacia el login.
  const [introStage, setIntroStage] = useState(
    prefersReducedMotion ? 'hidden' : 'show'
  )

  useEffect(() => {
    if (prefersReducedMotion) return

    const fadeTimer = setTimeout(() => {
      setIntroStage('fade')
    }, 850)

    const hideTimer = setTimeout(() => {
      setIntroStage('hidden')
    }, 850 + 500)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [prefersReducedMotion])

  useEffect(() => {
    if (loading) return

    if (!user || !role) return

    if (role === 'admin') {
      navigate('/dashboard', { replace: true })
      return
    }

    if (role === 'empleado') {
      navigate('/empleado', { replace: true })
    }
  }, [user, role, loading, navigate])

  const handleLogin = async (e) => {
    e.preventDefault()

    try {
      setLoginLoading(true)

      await signInWithEmailAndPassword(auth, email, password)

      /*
        No hacemos navigate aquí.

        AuthContext detectará al usuario,
        consultará su rol en Firestore
        y el useEffect de arriba realizará
        la redirección correspondiente.
      */
    } catch (error) {
      console.error('Error login:', error)

      alert('Credenciales incorrectas')
    } finally {
      setLoginLoading(false)
    }
  }

  return (
    <div className="login-page">
      {introStage !== 'hidden' && (
        <div
          className={`login-intro ${
            introStage === 'fade' ? 'login-intro-fade' : ''
          }`}
        >
          <img
            src={logo}
            alt="Arte Grafia"
            className="login-intro-logo"
          />
        </div>
      )}

      <div className="login-card-wrapper">
        <div className="login-card">
          <img
            src={logo}
            alt="Arte Grafia"
            className="login-card-logo"
          />

          <h3 className="login-title">Iniciar sesión</h3>
          <p className="login-subtitle">
            Asistente de Personalización de Uniformes
          </p>

          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label className="login-label">Email</label>

              <input
                type="email"
                className="login-input"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
              />
            </div>

            <div className="login-field">
              <label className="login-label">Contraseña</label>

              <input
                type="password"
                className="login-input"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
              />
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={loginLoading || loading}
            >
              {loginLoading ? 'Ingresando...' : 'Ingresar'}
            </button>
          </form>
        </div>
      </div>
    </div>
  )
}

export default LoginPage