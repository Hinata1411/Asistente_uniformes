import { useState } from 'react'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth'

import { auth } from '../firebase/config'
import { useAuth } from '../context/AuthContext'

import './ProfilePage.css'

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

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false)

  const [showNewPassword, setShowNewPassword] =
    useState(false)

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false)

  const [loading, setLoading] =
    useState(false)

  const [message, setMessage] =
    useState('')

  const [errorMessage, setErrorMessage] =
    useState('')

  const handleSubmit = async (event) => {
    event.preventDefault()

    setMessage('')
    setErrorMessage('')

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
        Firebase crea una credencial temporal utilizando
        el correo del usuario y su contraseña actual.

        La contraseña no se guarda en Firestore.
      */
      const credential =
        EmailAuthProvider.credential(
          user.email,
          currentPassword
        )

      /*
        Se verifica nuevamente la identidad del usuario
        porque cambiar la contraseña es una operación
        sensible.
      */
      await reauthenticateWithCredential(
        auth.currentUser,
        credential
      )

      /*
        Firebase Authentication actualiza y protege
        la contraseña.
      */
      await updatePassword(
        auth.currentUser,
        newPassword
      )

      setCurrentPassword('')
      setNewPassword('')
      setConfirmPassword('')

      setMessage(
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
            .toUpperCase()}
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
                  : 'Empleado'}
              </strong>
            </div>
          </div>

          <div className="profile-security-note">
            🔒 El cambio de contraseña no modifica tu
            correo, rol ni información del perfil.
          </div>
        </section>

        <section className="profile-card">
          <h3>Cambiar contraseña</h3>

          <p className="profile-description">
            Por seguridad, primero debes confirmar tu
            contraseña actual.
          </p>

          {message && (
            <div
              className="profile-alert success"
              role="status"
            >
              {message}
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
                  onChange={(event) =>
                    setCurrentPassword(
                      event.target.value
                    )
                  }
                  autoComplete="current-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowCurrentPassword(
                      (previous) => !previous
                    )
                  }
                  aria-label={
                    showCurrentPassword
                      ? 'Ocultar contraseña actual'
                      : 'Mostrar contraseña actual'
                  }
                >
                  {showCurrentPassword
                    ? 'Ocultar'
                    : 'Mostrar'}
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
                  onChange={(event) =>
                    setNewPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowNewPassword(
                      (previous) => !previous
                    )
                  }
                  aria-label={
                    showNewPassword
                      ? 'Ocultar nueva contraseña'
                      : 'Mostrar nueva contraseña'
                  }
                >
                  {showNewPassword
                    ? 'Ocultar'
                    : 'Mostrar'}
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
                  onChange={(event) =>
                    setConfirmPassword(
                      event.target.value
                    )
                  }
                  autoComplete="new-password"
                  disabled={loading}
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowConfirmPassword(
                      (previous) => !previous
                    )
                  }
                  aria-label={
                    showConfirmPassword
                      ? 'Ocultar confirmación'
                      : 'Mostrar confirmación'
                  }
                >
                  {showConfirmPassword
                    ? 'Ocultar'
                    : 'Mostrar'}
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