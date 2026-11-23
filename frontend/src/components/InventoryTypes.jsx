import { useEffect, useRef, useState } from 'react'
import { doc, getDoc, getFirestore, runTransaction } from 'firebase/firestore/lite'
import { db } from '../firebase/config'

const defaults = { prenda: [
    {
      "id": "playera",
      "label": "Playera"
    },
    {
      "id": "polo",
      "label": "Playera Polo"
    },
    {
      "id": "camisa_columbia",
      "label": "Camisa Columbia"
    },
    {
      "id": "jersey",
      "label": "Jersey"
    },
    {
      "id": "uniforme_futbol",
      "label": "Uniforme de fútbol"
    },
    {
      "id": "pantalon",
      "label": "Pantalón"
    },
    {
      "id": "short",
      "label": "Short"
    },
    {
      "id": "kit",
      "label": "Kit / Conjunto"
    },
    {
      "id": "otro",
      "label": "Otro"
    }
  ], producto: [] }
const catalogDb = getFirestore(db.app)
const configRef = category => doc(catalogDb, 'inventoryTypes', category)
function checkTypes(types) {
  if (!Array.isArray(types) || types.some(type =>
    !type || typeof type.id !== 'string' || typeof type.label !== 'string',
  )) throw new Error('La lista de tipos tiene un formato inválido.')
  return types
}
const readTypes = (snapshot, category) =>
  snapshot.exists() ? checkTypes(snapshot.data().types) : defaults[category]

const localKey = category => 'artegrafia.inventoryTypes.' + category
const localEvent = 'artegrafia:inventory-types'

function readLocalTypes(category) {
  const stored = localStorage.getItem(localKey(category))
  if (!stored) return defaults[category]
  return checkTypes(JSON.parse(stored))
}

export function useInventoryTypes(category) {
  const [state, setState] = useState(null)
  useEffect(() => {
    let active = true
    let request = 0
    let timer
    let localMode = false
    function useLocal() {
      localMode = true
      try {
        setState({ category, types: readLocalTypes(category), local: true })
      } catch {
        setState({ category, types: defaults[category], local: true, error: true })
      }
    }
    function load() {
      const current = ++request
      window.clearTimeout(timer)
      if (localMode) {
        useLocal()
        return
      }
      timer = window.setTimeout(() => {
        request++
        useLocal()
      }, 4000)
      getDoc(configRef(category)).then(snapshot => {
        if (!active || current !== request) return
        const types = readTypes(snapshot, category)
        window.clearTimeout(timer)
        setState({ category, types })
      }).catch(() => {
        if (!active || current !== request) return
        window.clearTimeout(timer)
        useLocal()
      })
    }
    load()
    window.addEventListener(localEvent, load)
    function onStorage(event) {
      if (localMode && (event.key === localKey(category) || event.key === null)) useLocal()
    }
    window.addEventListener('storage', onStorage)
    return () => {
      active = false
      window.clearTimeout(timer)
      window.removeEventListener(localEvent, load)
      window.removeEventListener('storage', onStorage)
    }
  }, [category])
  return state?.category === category
    ? state
    : { types: defaults[category], loading: true }
}

function changeTypes(types, id, label) {
  if (id && !types.some(type => type.id === id && !type.inactive)) {
    throw new Error('El tipo ya no está disponible.')
  }
  if (label && types.some(type => !type.inactive && type.id !== id &&
    type.label.localeCompare(label, 'es', { sensitivity: 'base' }) === 0)) {
    throw new Error('Ya existe un tipo con ese nombre.')
  }
  const existingId = id || types.find(type => type.id === label)?.id
  return existingId
    ? types.map(type => type.id === existingId
      ? label ? { id: existingId, label } : { ...type, inactive: true }
      : type)
    : [...types, { id: label, label }]
}

async function saveType(category, id, label, local) {
  if (local) {
    const updated = changeTypes(readLocalTypes(category), id, label)
    localStorage.setItem(localKey(category), JSON.stringify(updated))
    window.dispatchEvent(new Event(localEvent))
    return
  }
  const ref = configRef(category)
  await runTransaction(catalogDb, async transaction => {
    const snapshot = await transaction.get(ref)
    transaction.set(ref, { types: changeTypes(readTypes(snapshot, category), id, label) })
  })
  window.dispatchEvent(new Event(localEvent))
}

export default function InventoryTypeEditor({ onClose }) {
  const dialog = useRef(null)
  useEffect(() => {
    const element = dialog.current
    if (!element || element.open) return
    if (typeof element.showModal === 'function') element.showModal()
    else element.setAttribute('open', '')
  }, [])
  const [category, setCategory] = useState('prenda')
  const [editing, setEditing] = useState('')
  const [label, setLabel] = useState('')
  const [busy, setBusy] = useState(false)
  const [saveError, setSaveError] = useState('')
  const { types, loading, local, error } = useInventoryTypes(category)
  const clear = () => {
    setEditing('')
    setLabel('')
  }
  const save = async (id, value) => {
    setSaveError('')
    setBusy(true)
    try {
      await saveType(category, id, value, local)
      clear()
    } catch (err) {
      setSaveError(err.message || 'No se pudo guardar el cambio.')
    } finally {
      setBusy(false)
    }
  }

  return (
    <dialog ref={dialog} onClose={onClose} aria-labelledby="inventory-types-title"
      className="app-card border-0 rounded-3 shadow p-4"
      style={{ width: 'min(32rem, calc(100% - 2rem))', maxHeight: '85vh' }}>
      <header className="d-flex justify-content-between align-items-center mb-3">
        <h3 id="inventory-types-title" className="h5 mb-0">Editar tipos</h3>
        <button type="button" className="btn-close" aria-label="Cerrar" onClick={onClose} />
      </header>
      <fieldset disabled={busy}>
        <label className="form-label">
          Categoría
          <select className="form-select" value={category} onChange={event => {
            setCategory(event.target.value)
            clear()
          }}>
            <option value="prenda">Prendas</option>
            <option value="producto">Productos</option>
          </select>
        </label>
        {loading && <p>Cargando tipos...</p>}
        {error && <p role="alert">El navegador no pudo abrir la lista guardada.</p>}
        {local && !error && <p className="form-text">Los cambios se guardan en este navegador.</p>}
        <div className="table-responsive">
          <table className="table table-sm align-middle">
            <thead><tr><th scope="col">Tipo</th><th scope="col" className="text-end">Acciones</th></tr></thead>
            <tbody>
              {!loading && !types.some(type => !type.inactive) && (
                <tr><td colSpan={2} className="text-muted">Todavía no hay tipos en esta categoría.</td></tr>
              )}
              {types.filter(type => !type.inactive).map(type => (
                <tr key={type.id}>
                  <td>{type.label}</td>
                  <td className="text-end text-nowrap">
                    <button type="button" className="btn btn-sm btn-outline-secondary me-2"
                      disabled={loading || error} onClick={() => {
                        setEditing(type.id)
                        setLabel(type.label)
                      }}>Editar</button>
                    <button type="button" className="btn btn-sm btn-outline-danger"
                      disabled={loading || error} onClick={() => {
                        if (window.confirm('¿Quitar este tipo de los nuevos artículos?')) void save(type.id, '')
                      }}>Eliminar</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        {saveError && <p className="text-danger" role="alert">{saveError}</p>}
        <form onSubmit={event => {
          event.preventDefault()
          if (label.trim() && !loading && !error) void save(editing, label.trim())
        }}>
          <label className="form-label">
            {editing ? 'Editar nombre' : 'Nuevo tipo'}
            <input className="form-control" value={label} maxLength={80} required
              onChange={event => setLabel(event.target.value)} />
          </label>
          <div className="d-flex gap-2">
            <button type="submit" className="btn btn-primary" disabled={loading || error || !label.trim()}>
              {editing ? 'Guardar nombre' : 'Agregar tipo'}
            </button>
            {editing && <button type="button" className="btn btn-outline-secondary" onClick={clear}>Cancelar</button>}
          </div>
        </form>
      </fieldset>
    </dialog>
  )
}
