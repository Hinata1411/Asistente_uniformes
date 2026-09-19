// Diálogos de confirmación / entrada de texto con el estilo de la
// marca, en vez de window.confirm() y window.prompt() del navegador.
// DialogHost.jsx se suscribe y dibuja el diálogo activo.
//
// A diferencia de toastStore (que puede apilar varias notificaciones),
// aquí solo hay UN diálogo activo a la vez: el código que lo pide
// espera su resultado con `await` antes de seguir, igual que antes
// esperaba el valor de retorno de confirm()/prompt().

let activeDialog = null
let listeners = []

const emit = () => {
  listeners.forEach((listener) => listener(activeDialog))
}

export const subscribeDialog = (listener) => {
  listeners.push(listener)

  return () => {
    listeners = listeners.filter((item) => item !== listener)
  }
}

export const getActiveDialog = () => activeDialog

const openDialog = (dialog) =>
  new Promise((resolve) => {
    activeDialog = { ...dialog, resolve }
    emit()
  })

// Llamado por DialogHost cuando la persona responde el diálogo.
export const resolveDialog = (result) => {
  const resolve = activeDialog?.resolve
  activeDialog = null
  emit()
  if (resolve) resolve(result)
}

// Reemplaza window.confirm(mensaje): resuelve a true o false.
export const askConfirm = (message, options = {}) =>
  openDialog({
    type: 'confirm',
    message,
    confirmLabel: options.confirmLabel || 'Continuar',
    cancelLabel: options.cancelLabel || 'Cancelar',
    danger: options.danger || false
  })

// Reemplaza window.prompt(mensaje): resuelve al texto ingresado, o
// '' si se cancela o se deja vacío (mismo comportamiento que antes
// con `if (!reason) return`).
export const askPrompt = (message, options = {}) =>
  openDialog({
    type: 'prompt',
    message,
    confirmLabel: options.confirmLabel || 'Continuar',
    cancelLabel: options.cancelLabel || 'Cancelar',
    placeholder: options.placeholder || '',
    danger: options.danger || false
  })