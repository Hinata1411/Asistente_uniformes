// "Pub-sub" simple en memoria para mostrar notificaciones con el
// estilo de la marca en toda la app, en vez de los alert() nativos
// del navegador. No depende de React, así que se puede llamar desde
// cualquier función (manejadores de eventos, catch de un try/catch,
// hooks) exactamente igual que se llamaba a alert(mensaje).
//
// ToastContainer.jsx se suscribe a este store y dibuja las
// notificaciones activas.

let toasts = []
let listeners = []
let nextId = 1

const emit = () => {
  listeners.forEach((listener) => listener(toasts))
}

export const subscribeToasts = (listener) => {
  listeners.push(listener)

  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

export const getToasts = () => toasts

export const dismissToast = (id) => {
  toasts = toasts.filter((toast) => toast.id !== id)
  emit()
}

// type: 'error' (por defecto, mismo uso que alert()), 'success' o
// 'warning'. duration en milisegundos; 0 deja el aviso fijo hasta
// que se cierre manualmente.
export const notify = (message, type = 'error', duration = 6000) => {
  const id = nextId++

  toasts = [...toasts, { id, message: String(message), type }]
  emit()

  if (duration) {
    setTimeout(() => dismissToast(id), duration)
  }

  return id
}