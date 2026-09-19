import { useEffect, useState } from 'react'
import { subscribeToasts, getToasts, dismissToast } from '../services/toastStore'
import '../styles/ToastContainer.css'

const ICONS = {
  success: '✓',
  warning: '!',
  error: '✕'
}

// Se monta una sola vez en App.jsx. Reemplaza los alert() nativos:
// cualquier parte de la app llama a notify(mensaje, tipo) desde
// services/toastStore y el aviso aparece aquí, con el estilo de
// marca, sin bloquear la pantalla como el alert() del navegador.
function ToastContainer() {
  const [toasts, setToasts] = useState(getToasts())

  useEffect(() => subscribeToasts(setToasts), [])

  if (toasts.length === 0) return null

  return (
    <div className="toast-stack">
      {toasts.map((toast) => (
        <div key={toast.id} className={`toast-item toast-${toast.type}`}>
          <span className="toast-icon">
            {ICONS[toast.type] || ICONS.error}
          </span>

          <span className="toast-message">{toast.message}</span>

          <button
            type="button"
            className="toast-close"
            onClick={() => dismissToast(toast.id)}
            aria-label="Cerrar notificación"
          >
            ×
          </button>
        </div>
      ))}
    </div>
  )
}

export default ToastContainer