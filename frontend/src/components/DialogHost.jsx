import { useEffect, useState } from 'react'
import { subscribeDialog, getActiveDialog, resolveDialog } from '../services/dialogStore'
import '../styles/DialogHost.css'

// Se monta una sola vez en App.jsx. Reemplaza window.confirm() y
// window.prompt() del navegador por un diálogo modal con el estilo
// de marca. El código que llama a askConfirm()/askPrompt() sigue
// esperando el resultado con `await`, exactamente igual que antes.
function DialogHost() {
  const [dialog, setDialog] = useState(getActiveDialog())
  const [inputValue, setInputValue] = useState('')

  useEffect(
    () =>
      subscribeDialog((next) => {
        setDialog(next)
        setInputValue('')
      }),
    []
  )

  if (!dialog) return null

  const handleCancel = () => {
    resolveDialog(dialog.type === 'prompt' ? '' : false)
  }

  const handleConfirm = () => {
    resolveDialog(dialog.type === 'prompt' ? inputValue.trim() : true)
  }

  return (
    <div className="dialog-overlay" onClick={handleCancel}>
      <div
        className="dialog-box"
        role={dialog.type === 'prompt' ? 'dialog' : 'alertdialog'}
        aria-modal="true"
        onClick={(event) => event.stopPropagation()}
      >
        <p className="dialog-message">{dialog.message}</p>

        {dialog.type === 'prompt' && (
          <input
            type="text"
            className="dialog-input"
            autoFocus
            value={inputValue}
            placeholder={dialog.placeholder}
            onChange={(event) => setInputValue(event.target.value)}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleConfirm()
              if (event.key === 'Escape') handleCancel()
            }}
          />
        )}

        <div className="dialog-actions">
          <button
            type="button"
            className="dialog-btn dialog-btn-cancel"
            onClick={handleCancel}
          >
            {dialog.cancelLabel}
          </button>

          <button
            type="button"
            className={`dialog-btn dialog-btn-confirm ${
              dialog.danger ? 'dialog-btn-danger' : ''
            }`}
            onClick={handleConfirm}
          >
            {dialog.confirmLabel}
          </button>
        </div>
      </div>
    </div>
  )
}

export default DialogHost