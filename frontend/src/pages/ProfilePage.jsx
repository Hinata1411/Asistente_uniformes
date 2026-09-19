import { useState } from 'react'

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth'

import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

import './ProfilePage.css'

function EyeIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M2 12s3.5-7 10-7 10 7 10 7-3.5 7-10 7S2 12 2 12Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <circle
        cx="12"
        cy="12"
        r="3"
        stroke="currentColor"
        strokeWidth="2"
      />
    </svg>
  )
}

function EyeOffIcon() {
  return (
    <svg
      width="21"
      height="21"
      viewBox="0 0 24 24"
      fill="none"
      aria-hidden="true"
    >
      <path
        d="M3 3l18 18"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />

      <path
        d="M10.6 5.2A10.8 10.8 0 0 1 12 5c6.5 0 10 7 10 7a15.8 15.8 0 0 1-2.1 3.1"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M6.2 6.2C3.5 8.1 2 12 2 12s3.5 7 10 7a10.7 10.7 0 0 0 5.8-1.8"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      <path
        d="M10.7 10.7a2 2 0 0 0-.7 1.5A2.2 2.2 0 0 0 12.2 14a2 2 0 0 0 1.5-.7"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
      />
    </svg>
  )
}

const validatePassword = (password) => {
  if (password.length < 8) {
    return 'La contraseña debe tener al menos 8 caracteres.'
  }

  if (!/[A-Z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra mayúscula.'
  }

  if (!/[a-z]/.test(password)) {
    return 'La contraseña debe incluir al menos una letra minúscula.'
  }

  if (!/[0-9]/.test(password)) {
    return 'La contraseña debe incluir al menos un número.'
  }

  return ''
}

const getFirebaseErrorMessage = (error) => {
  switch (error.code) {
    case 'auth/invalid-credential':
    case 'auth/wrong-password':
      return 'La contraseña actual es incorrecta.'

    case 'auth/too-many-requests':
      return 'Se realizaron demasiados intentos. Espera unos minutos e inténtalo nuevamente.'

    case 'auth/weak-password':
      return 'La nueva contraseña no cumple con los requisitos mínimos de seguridad.'

    case 'auth/requires-recent-login':
      return 'Por seguridad debes volver a autenticarte antes de cambiar la contraseña.'

    case 'auth/network-request-failed':
      return 'No se pudo conectar con Firebase. Revisa tu conexión a Internet.'

    case 'auth/user-disabled':
      return 'Esta cuenta ha sido deshabilitada.'

    case 'auth/user-not-found':
      return 'No se encontró la cuenta del usuario.'

    case 'auth/operation-not-allowed':
      return 'El cambio de contraseña no está habilitado para esta cuenta.'

    default:
      return 'No se pudo actualizar la contraseña. Inténtalo nuevamente.'
  }
}

function ProfilePage() {
  const { user, role } = useAuth()

  const [currentPassword, setCurrentPassword] =
    useState('')

  const [newPassword, setNewPassword] =
    useState('')

  const [confirmPassword, setConfirmPassword] =
    useState('')

  const [
    showCurrentPassword,
    setShowCurrentPassword
  ] = useState(false)

  const [
    showNewPassword,
    setShowNewPassword
  ] = useState(false)

  const [
    showConfirmPassword,
    setShowConfirmPassword
  ] = useState(false)

  const [loading, setLoading] =
    useState(false)

  const [successMessage, setSuccessMessage] =
    useState('')

  const [errorMessage, setErrorMessage] =
    useState('')

  const clearMessages = () => {
    setSuccessMessage('')
    setErrorMessage('')
  }

  const clearForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')

    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const handleSubmit = async (event) => {
    event.preventDefault()

    clearMessages()

    if (!user || !auth.currentUser) {
      setErrorMessage(
        'No se encontró una sesión activa.'
      )
      return
    }

    if (!user.email) {
      setErrorMessage(
        'La cuenta no tiene un correo electrónico disponible para realizar la verificación.'
      )
      return
    }

    if (
      !currentPassword ||
      !newPassword ||
      !confirmPassword
    ) {
      setErrorMessage(
        'Completa todos los campos.'
      )
      return
    }

    if (newPassword !== confirmPassword) {
      setErrorMessage(
        'La nueva contraseña y su confirmación no coinciden.'
      )
      return
    }

    if (currentPassword === newPassword) {
      setErrorMessage(
        'La nueva contraseña debe ser diferente de la contraseña actual.'
      )
      return
    }

    const passwordValidation =
      validatePassword(newPassword)

    if (passwordValidation) {
      setErrorMessage(passwordValidation)
      return
    }

    try {
      setLoading(true)

      /*
        La credencial se crea temporalmente para
        comprobar la contraseña actual.

        No se guarda en Firestore ni en localStorage.
      */
      const credential =
        EmailAuthProvider.credential(
          user.email,
          currentPassword
        )

      /*
        Firebase solicita autenticación reciente
        para esta operación sensible.
      */
      await reauthenticateWithCredential(
        auth.currentUser,
        credential
      )

      /*
        Firebase Authentication actualiza
        la contraseña de forma segura.
      */
      await updatePassword(
        auth.currentUser,
        newPassword
      )

      clearForm()

      setSuccessMessage(
        'Contraseña actualizada correctamente.'
      )
    } catch (error) {
      console.error(
        'Error cambiando contraseña:',
        error
      )

      setErrorMessage(
        getFirebaseErrorMessage(error)
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <span className="profile-eyebrow">
            Seguridad de la cuenta
          </span>

          <h2>Mi perfil</h2>

          <p>
            Consulta los datos de tu cuenta y cambia tu
            contraseña de forma segura.
          </p>
        </div>

        <div className="profile-avatar">
          {user?.email
            ?.charAt(0)
            .toUpperCase() || '?'}
        </div>
      </div>

      <div className="profile-grid">
        <section className="profile-card">
          <h3>Información de la cuenta</h3>

          <div className="profile-information">
            <div>
              <span>Correo electrónico</span>

              <strong>
                {user?.email || 'No disponible'}
              </strong>
            </div>

            <div>
              <span>Rol en el sistema</span>

              <strong>
                {role === 'admin'
                  ? 'Administrador'
                  : role === 'empleado'
                    ? 'Empleado'
                    : 'Sin rol asignado'}
              </strong>
            </div>
          </div>

          <div className="profile-security-note">
            <span aria-hidden="true">🔒</span>

            <span>
              El cambio de contraseña no modifica tu
              correo electrónico, rol ni información
              del perfil.
            </span>
          </div>
        </section>

        <section className="profile-card">
          <h3>Cambiar contraseña</h3>

          <p className="profile-description">
            Por seguridad, primero debes confirmar tu
            contraseña actual.
          </p>

          {successMessage && (
            <div
              className="profile-alert success"
              role="status"
            >
              {successMessage}
            </div>
          )}

          {errorMessage && (
            <div
              className="profile-alert error"
              role="alert"
            >
              {errorMessage}
            </div>
          )}

          <form onSubmit={handleSubmit}>
            <div className="password-field">
              <label htmlFor="currentPassword">
                Contraseña actual
              </label>

              <div className="password-control">
                <input
                  id="currentPassword"
                  type={
                    showCurrentPassword
                      ? 'text'
                      : 'password'
                  }
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(
                      event.target.value
                    )

                    clearMessages()
                  }}
                  autoComplete="current-password"
                  disabled={loading}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowCurrentPassword(
                      (previous) => !previous
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showCurrentPassword
                      ? 'Ocultar contraseña actual'
                      : 'Mostrar contraseña actual'
                  }
                  title={
                    showCurrentPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  {showCurrentPassword
                    ? <EyeOffIcon />
                    : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="password-field">
              <label htmlFor="newPassword">
                Nueva contraseña
              </label>

              <div className="password-control">
                <input
                  id="newPassword"
                  type={
                    showNewPassword
                      ? 'text'
                      : 'password'
                  }
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(
                      event.target.value
                    )

                    clearMessages()
                  }}
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowNewPassword(
                      (previous) => !previous
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showNewPassword
                      ? 'Ocultar nueva contraseña'
                      : 'Mostrar nueva contraseña'
                  }
                  title={
                    showNewPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  {showNewPassword
                    ? <EyeOffIcon />
                    : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="password-field">
              <label htmlFor="confirmPassword">
                Confirmar nueva contraseña
              </label>

              <div className="password-control">
                <input
                  id="confirmPassword"
                  type={
                    showConfirmPassword
                      ? 'text'
                      : 'password'
                  }
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(
                      event.target.value
                    )

                    clearMessages()
                  }}
                  autoComplete="new-password"
                  disabled={loading}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword(
                      (previous) => !previous
                    )
                  }
                  disabled={loading}
                  aria-label={
                    showConfirmPassword
                      ? 'Ocultar confirmación'
                      : 'Mostrar confirmación'
                  }
                  title={
                    showConfirmPassword
                      ? 'Ocultar contraseña'
                      : 'Mostrar contraseña'
                  }
                >
                  {showConfirmPassword
                    ? <EyeOffIcon />
                    : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="password-requirements">
              <strong>
                La contraseña debe contener:
              </strong>

              <ul>
                <li>Al menos 8 caracteres.</li>
                <li>Una letra mayúscula.</li>
                <li>Una letra minúscula.</li>
                <li>Un número.</li>
              </ul>
            </div>

            <button
              type="submit"
              className="change-password-button"
              disabled={loading}
            >
              {loading
                ? 'Actualizando contraseña...'
                : 'Actualizar contraseña'}
            </button>
          </form>
        </section>
      </div>
    </div>
  )
}

export default ProfilePage