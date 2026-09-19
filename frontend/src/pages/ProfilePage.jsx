import { useEffect, useState } from 'react'

import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword
} from 'firebase/auth'

import { doc, getDoc, updateDoc } from 'firebase/firestore'

import { auth, db } from '../firebase/config'
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

const ROLE_LABELS = {
  admin: 'Administrador',
  empleado: 'Empleado'
}

const STATUS_LABELS = {
  activo: 'Activo',
  inactivo: 'Inactivo'
}

// Teléfono flexible: dígitos, espacios, guiones y un + opcional al inicio.
const PHONE_REGEX = /^\+?[0-9\s-]{6,15}$/

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

  // =========================================
  // DATOS PERSONALES (nombre y teléfono)
  // Documento Firestore users/{uid}: name, phone, status, role.
  // =========================================

  const [profile, setProfile] = useState(null)
  const [loadingProfile, setLoadingProfile] = useState(true)
  const [savingInfo, setSavingInfo] = useState(false)
  const [infoForm, setInfoForm] = useState({ name: '', phone: '' })
  const [infoErrors, setInfoErrors] = useState({})
  const [infoFeedback, setInfoFeedback] = useState(null)

  useEffect(() => {
    const loadProfile = async () => {
      if (!user?.uid) return

      try {
        setLoadingProfile(true)

        const userRef = doc(db, 'users', user.uid)
        const userSnap = await getDoc(userRef)

        if (userSnap.exists()) {
          const data = userSnap.data()

          setProfile(data)
          setInfoForm({
            name: data.name || '',
            phone: data.phone || ''
          })
        }
      } catch (error) {
        console.error('Error cargando el perfil:', error)
        setInfoFeedback({
          type: 'error',
          message: 'No se pudo cargar tu información personal.'
        })
      } finally {
        setLoadingProfile(false)
      }
    }

    loadProfile()
  }, [user?.uid])

  const handleInfoChange = (field) => (event) => {
    let value = event.target.value

    // Igual que en Crear pedido: nombre solo letras, teléfono solo
    // dígitos, filtrados mientras se escribe.
    if (field === 'name') {
      value = value.replace(/[^\p{L}\s'-]/gu, '')
    } else if (field === 'phone') {
      value = value.replace(/\D/g, '')
    }

    setInfoForm((prev) => ({ ...prev, [field]: value }))
    setInfoErrors((prev) => ({ ...prev, [field]: null }))
  }

  const validateInfo = () => {
    const nextErrors = {}

    if (!infoForm.name.trim()) {
      nextErrors.name = 'El nombre es obligatorio.'
    } else if (!/^[\p{L}\s'-]+$/u.test(infoForm.name.trim())) {
      nextErrors.name = 'El nombre solo puede contener letras.'
    }

    if (infoForm.phone.trim() && !PHONE_REGEX.test(infoForm.phone.trim())) {
      nextErrors.phone = 'Ingresa un teléfono válido.'
    }

    setInfoErrors(nextErrors)
    return Object.keys(nextErrors).length === 0
  }

  const handleInfoSubmit = async (event) => {
    event.preventDefault()
    setInfoFeedback(null)

    if (!validateInfo()) return

    const updates = {
      name: infoForm.name.trim(),
      phone: infoForm.phone.trim()
    }

    try {
      setSavingInfo(true)

      await updateDoc(doc(db, 'users', user.uid), updates)

      // Se refleja de inmediato en pantalla, sin recargar ni
      // pedir que se vuelva a iniciar sesión.
      setProfile((prev) => ({ ...prev, ...updates }))

      setInfoFeedback({
        type: 'success',
        message: 'Tu información personal se actualizó correctamente.'
      })
    } catch (error) {
      console.error('Error actualizando el perfil:', error)
      // No se toca `profile` ni `infoForm`: si falla, lo que ya
      // estaba guardado sigue visible tal como estaba.
      setInfoFeedback({
        type: 'error',
        message:
          'No se pudo guardar el cambio. Tu información anterior sigue intacta, intenta de nuevo.'
      })
    } finally {
      setSavingInfo(false)
    }
  }

  // =========================================
  // CAMBIO DE CONTRASEÑA
  // =========================================

  const [currentPassword, setCurrentPassword] = useState('')
  const [newPassword, setNewPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')

  const [showCurrentPassword, setShowCurrentPassword] = useState(false)
  const [showNewPassword, setShowNewPassword] = useState(false)
  const [showConfirmPassword, setShowConfirmPassword] = useState(false)

  const [loadingPassword, setLoadingPassword] = useState(false)
  const [passwordSuccessMessage, setPasswordSuccessMessage] = useState('')
  const [passwordErrorMessage, setPasswordErrorMessage] = useState('')

  const clearPasswordMessages = () => {
    setPasswordSuccessMessage('')
    setPasswordErrorMessage('')
  }

  const clearPasswordForm = () => {
    setCurrentPassword('')
    setNewPassword('')
    setConfirmPassword('')

    setShowCurrentPassword(false)
    setShowNewPassword(false)
    setShowConfirmPassword(false)
  }

  const handlePasswordSubmit = async (event) => {
    event.preventDefault()

    clearPasswordMessages()

    if (!user || !auth.currentUser) {
      setPasswordErrorMessage('No se encontró una sesión activa.')
      return
    }

    if (!user.email) {
      setPasswordErrorMessage(
        'La cuenta no tiene un correo electrónico disponible para realizar la verificación.'
      )
      return
    }

    if (!currentPassword || !newPassword || !confirmPassword) {
      setPasswordErrorMessage('Completa todos los campos.')
      return
    }

    if (newPassword !== confirmPassword) {
      setPasswordErrorMessage(
        'La nueva contraseña y su confirmación no coinciden.'
      )
      return
    }

    if (currentPassword === newPassword) {
      setPasswordErrorMessage(
        'La nueva contraseña debe ser diferente de la contraseña actual.'
      )
      return
    }

    const passwordValidation = validatePassword(newPassword)

    if (passwordValidation) {
      setPasswordErrorMessage(passwordValidation)
      return
    }

    try {
      setLoadingPassword(true)

      const credential = EmailAuthProvider.credential(
        user.email,
        currentPassword
      )

      await reauthenticateWithCredential(auth.currentUser, credential)
      await updatePassword(auth.currentUser, newPassword)

      clearPasswordForm()

      setPasswordSuccessMessage('Contraseña actualizada correctamente.')
    } catch (error) {
      console.error('Error cambiando contraseña:', error)
      setPasswordErrorMessage(getFirebaseErrorMessage(error))
    } finally {
      setLoadingPassword(false)
    }
  }

  return (
    <div className="profile-page">
      <div className="profile-header">
        <div>
          <span className="profile-eyebrow">Mi cuenta</span>

          <h2>Mi perfil</h2>

          <p>
            Consulta tus datos, actualiza tu información personal y
            cambia tu contraseña de forma segura.
          </p>
        </div>

        <div className="profile-avatar">
          {user?.email?.charAt(0).toUpperCase() || '?'}
        </div>
      </div>

      <div className="profile-grid">
        <div className="profile-column">
          <section className="profile-card">
            <h3>Información de la cuenta</h3>

            <div className="profile-information">
              <div>
                <span>Correo electrónico</span>

                <strong>{user?.email || 'No disponible'}</strong>
              </div>

              <div>
                <span>Rol en el sistema</span>

                <strong>
                  {ROLE_LABELS[role] || role || 'Sin rol asignado'}
                </strong>
              </div>

              <div>
                <span>Estado</span>

                <strong>
                  {STATUS_LABELS[profile?.status] ||
                    profile?.status ||
                    'Activo'}
                </strong>
              </div>
            </div>

            <div className="profile-security-note">
              <span aria-hidden="true">🔒</span>

              <span>
                Tu rol y tu estado los administra un administrador;
                no puedes modificarlos desde aquí.
              </span>
            </div>
          </section>

          <section className="profile-card">
            <h3>Datos personales</h3>

            <p className="profile-description">
              Actualiza tu nombre y tu teléfono de contacto.
            </p>

            {infoFeedback && (
              <div
                className={`profile-alert ${infoFeedback.type}`}
                role={infoFeedback.type === 'error' ? 'alert' : 'status'}
              >
                {infoFeedback.message}
              </div>
            )}

            {loadingProfile ? (
              <p className="profile-description">Cargando...</p>
            ) : (
              <form onSubmit={handleInfoSubmit}>
                <div className="password-field">
                  <label htmlFor="profileName">Nombre completo</label>

                  <input
                    id="profileName"
                    type="text"
                    className="profile-input"
                    value={infoForm.name}
                    onChange={handleInfoChange('name')}
                    disabled={savingInfo}
                  />

                  {infoErrors.name && (
                    <div className="field-error">{infoErrors.name}</div>
                  )}
                </div>

                <div className="password-field">
                  <label htmlFor="profilePhone">Teléfono</label>

                  <input
                    id="profilePhone"
                    type="tel"
                    className="profile-input"
                    value={infoForm.phone}
                    onChange={handleInfoChange('phone')}
                    disabled={savingInfo}
                    placeholder="Ej. 5555-5555"
                  />

                  {infoErrors.phone && (
                    <div className="field-error">{infoErrors.phone}</div>
                  )}
                </div>

                <button
                  type="submit"
                  className="change-password-button"
                  disabled={savingInfo}
                >
                  {savingInfo ? 'Guardando...' : 'Guardar datos personales'}
                </button>
              </form>
            )}
          </section>
        </div>

        <section className="profile-card">
          <h3>Cambiar contraseña</h3>

          <p className="profile-description">
            Por seguridad, primero debes confirmar tu contraseña
            actual.
          </p>

          {passwordSuccessMessage && (
            <div className="profile-alert success" role="status">
              {passwordSuccessMessage}
            </div>
          )}

          {passwordErrorMessage && (
            <div className="profile-alert error" role="alert">
              {passwordErrorMessage}
            </div>
          )}

          <form onSubmit={handlePasswordSubmit}>
            <div className="password-field">
              <label htmlFor="currentPassword">Contraseña actual</label>

              <div className="password-control">
                <input
                  id="currentPassword"
                  type={showCurrentPassword ? 'text' : 'password'}
                  value={currentPassword}
                  onChange={(event) => {
                    setCurrentPassword(event.target.value)
                    clearPasswordMessages()
                  }}
                  autoComplete="current-password"
                  disabled={loadingPassword}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowCurrentPassword((previous) => !previous)
                  }
                  disabled={loadingPassword}
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
                  {showCurrentPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="password-field">
              <label htmlFor="newPassword">Nueva contraseña</label>

              <div className="password-control">
                <input
                  id="newPassword"
                  type={showNewPassword ? 'text' : 'password'}
                  value={newPassword}
                  onChange={(event) => {
                    setNewPassword(event.target.value)
                    clearPasswordMessages()
                  }}
                  autoComplete="new-password"
                  disabled={loadingPassword}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowNewPassword((previous) => !previous)
                  }
                  disabled={loadingPassword}
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
                  {showNewPassword ? <EyeOffIcon /> : <EyeIcon />}
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
                  type={showConfirmPassword ? 'text' : 'password'}
                  value={confirmPassword}
                  onChange={(event) => {
                    setConfirmPassword(event.target.value)
                    clearPasswordMessages()
                  }}
                  autoComplete="new-password"
                  disabled={loadingPassword}
                  minLength={8}
                  required
                />

                <button
                  type="button"
                  className="password-toggle"
                  onClick={() =>
                    setShowConfirmPassword((previous) => !previous)
                  }
                  disabled={loadingPassword}
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
                  {showConfirmPassword ? <EyeOffIcon /> : <EyeIcon />}
                </button>
              </div>
            </div>

            <div className="password-requirements">
              <strong>La contraseña debe contener:</strong>

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
              disabled={loadingPassword}
            >
              {loadingPassword
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