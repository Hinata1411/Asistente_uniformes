import { useEffect, useMemo, useState } from 'react'
import {
  sendPasswordResetEmail,
  signInWithEmailAndPassword
} from 'firebase/auth'
import { useNavigate } from 'react-router-dom'

import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { notify } from '../services/toastStore'
import logo from '../assets/brand/arte-grafia-logo.png'
import '../styles/LoginPage.css'

function EyeIcon({ passwordVisible }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width="21"
      height="21"
      fill="none"
      stroke="currentColor"
      strokeWidth="2"
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
    >
      <path d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z" />
      <circle cx="12" cy="12" r="3" />

      {passwordVisible && (
        <path d="M3 3l18 18" />
      )}
    </svg>
  )
}

function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loginLoading, setLoginLoading] = useState(false)
  const [resetLoading, setResetLoading] = useState(false)

  const navigate = useNavigate()
  const { user, role, loading } = useAuth()

  const prefersReducedMotion = useMemo(
    () =>
      typeof window !== 'undefined' &&
      window.matchMedia(
        '(prefers-reduced-motion: reduce)'
      ).matches,
    []
  )

  const [introStage, setIntroStage] = useState(
    prefersReducedMotion ? 'hidden' : 'show'
  )

  useEffect(() => {
    if (prefersReducedMotion) {
      return undefined
    }

    const fadeTimer = setTimeout(() => {
      setIntroStage('fade')
    }, 850)

    const hideTimer = setTimeout(() => {
      setIntroStage('hidden')
    }, 1350)

    return () => {
      clearTimeout(fadeTimer)
      clearTimeout(hideTimer)
    }
  }, [prefersReducedMotion])

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
  }, [user, role, loading, navigate])

  const getLoginErrorMessage = (errorCode) => {
    switch (errorCode) {
      case 'auth/invalid-email':
        return 'El correo electrónico no es válido.'

      case 'auth/user-disabled':
        return 'Esta cuenta se encuentra desactivada.'

      case 'auth/too-many-requests':
        return 'Demasiados intentos. Espera unos minutos antes de intentarlo nuevamente.'

      case 'auth/network-request-failed':
        return 'No se pudo conectar con el servidor. Revisa tu conexión a internet.'

      case 'auth/invalid-credential':
      case 'auth/user-not-found':
      case 'auth/wrong-password':
        return 'El correo o la contraseña son incorrectos.'

      default:
        return 'No fue posible iniciar sesión. Inténtalo nuevamente.'
    }
  }

  const handleLogin = async (event) => {
    event.preventDefault()

    const normalizedEmail = email
      .trim()
      .toLowerCase()

    if (!normalizedEmail || !password) {
      notify(
        'Ingresa tu correo y contraseña',
        'error'
      )
      return
    }

    try {
      setLoginLoading(true)

      await signInWithEmailAndPassword(
        auth,
        normalizedEmail,
        password
      )

      /*
        AuthContext detectará al usuario,
        consultará su rol en Firestore y
        realizará la redirección.
      */
    } catch (error) {
      console.error(
        'Error iniciando sesión:',
        error
      )

      notify(
        getLoginErrorMessage(error.code),
        'error'
      )
    } finally {
      setLoginLoading(false)
    }
  }

  const handlePasswordReset = async () => {
    const normalizedEmail = email
      .trim()
      .toLowerCase()

    if (!normalizedEmail) {
      notify(
        'Escribe tu correo electrónico para enviarte el enlace de recuperación',
        'error'
      )
      return
    }

    try {
      setResetLoading(true)

      await sendPasswordResetEmail(
        auth,
        normalizedEmail
      )

      notify(
        'Enlace enviado. Revisa tu correo y la carpeta de spam',
        'success'
      )
    } catch (error) {
      console.error(
        'Error recuperando contraseña:',
        error
      )

      if (error.code === 'auth/invalid-email') {
        notify(
          'El correo electrónico no es válido',
          'error'
        )
        return
      }

      if (
        error.code ===
        'auth/too-many-requests'
      ) {
        notify(
          'Demasiadas solicitudes. Espera unos minutos',
          'error'
        )
        return
      }

      if (
        error.code ===
        'auth/network-request-failed'
      ) {
        notify(
          'Revisa tu conexión a internet',
          'error'
        )
        return
      }

      /*
        Se usa un mensaje general para no confirmar
        públicamente si determinado correo está
        registrado en Firebase Authentication.
      */
      notify(
        'No se pudo enviar el enlace de recuperación',
        'error'
      )
    } finally {
      setResetLoading(false)
    }
  }

  return (
    <div className="login-page">
      {introStage !== 'hidden' && (
        <div
          className={`login-intro ${
            introStage === 'fade'
              ? 'login-intro-fade'
              : ''
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

          <h1 className="login-title">
            Iniciar sesión
          </h1>

          <p className="login-subtitle">
            Asistente de Personalización de Uniformes
          </p>

          <form onSubmit={handleLogin}>
            <div className="login-field">
              <label
                className="login-label"
                htmlFor="login-email"
              >
                Correo electrónico
              </label>

              <input
                id="login-email"
                type="email"
                className="login-input"
                value={email}
                onChange={(event) =>
                  setEmail(event.target.value)
                }
                autoComplete="email"
                placeholder="correo@ejemplo.com"
                disabled={
                  loginLoading ||
                  resetLoading
                }
                required
              />
            </div>

            <div className="login-field">
              <label
                className="login-label"
                htmlFor="login-password"
              >
                Contraseña
              </label>

              <div className="login-password-control">
                <input
                  id="login-password"
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  className="login-input"
                  value={password}
                  onChange={(event) =>
                    setPassword(
                      event.target.value
                    )
                  }
                  autoComplete="current-password"
                  placeholder="Ingresa tu contraseña"
                  disabled={
                    loginLoading ||
                    resetLoading
                  }
                  required
                />

                <button
                  type="button"
                  className="login-password-toggle"
                  onClick={() =>
                    setShowPassword(
                      (current) => !current
                    )
                  }
                  aria-label={
                    showPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                  title={
                    showPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  <EyeIcon
                    passwordVisible={
                      showPassword
                    }
                  />
                </button>
              </div>
            </div>

            <div className="login-help-row">
              <button
                type="button"
                className="login-reset-link"
                onClick={handlePasswordReset}
                disabled={
                  resetLoading ||
                  loginLoading
                }
              >
                {resetLoading
                  ? 'Enviando enlace...'
                  : '¿Olvidaste tu contraseña?'}
              </button>
            </div>

            <button
              type="submit"
              className="login-button"
              disabled={
                loginLoading ||
                resetLoading ||
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
  )
}

export default LoginPage