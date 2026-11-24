import { useEffect, useState } from 'react'
import {
  collection,
  getDocs,
  getFirestore,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore/lite'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import { safeCatalogUrl } from '../services/businessModel'
import { notify } from '../services/toastStore'
import { askConfirm } from '../services/dialogStore'
import '../styles/BusinessPages.css'
const catalogsRef = collection(getFirestore(db.app), 'catalogs')

export default function CatalogsPage() {
  const { role } = useAuth(),
    admin = role === 'admin'
  const [items, setItems] = useState([]),
    [form, setForm] = useState({ name: '', url: '' }),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [error, setError] = useState(''),
    [loading, setLoading] = useState(true)
  useEffect(() => {
    let active = true
    getDocs(catalogsRef).then(snapshot => {
      if (!active) return
      setItems(snapshot.docs.map(entry => ({ ...entry.data(), id: entry.id })))
      setLoading(false)
    }).catch(() => {
      if (!active) return
      setError('No se pudieron cargar los catálogos. Revisa la conexión y los permisos.')
      setLoading(false)
    })
    return () => { active = false }
  }, [])
  const sortedItems = [...items].sort((a, b) => (a.name || '').localeCompare(b.name || '', 'es'))
  const cancel = () => {
    setEditing(null)
    setForm({ name: '', url: '' })
  }
  const save = async (e) => {
    e.preventDefault()
    if (!admin || busy) return
    const url = safeCatalogUrl(form.url.trim())
    if (!form.name.trim() || !url) {
      notify('Ingresa nombre y enlace válido http o https.', 'warning')
      return
    }
    setBusy(true)
    try {
      const data = {
        name: form.name.trim(),
        url,
        updatedAt: new Date().toISOString(),
      }
      if (editing) {
        await updateDoc(doc(catalogsRef, editing), data)
        setItems(previous => previous.map(item => item.id === editing ? { ...item, ...data } : item))
      } else {
        const entry = await addDoc(catalogsRef, { ...data, createdAt: data.updatedAt })
        setItems(previous => [...previous, { ...data, id: entry.id }])
      }
      cancel()
      notify('Catálogo guardado', 'success')
    } catch {
      notify('No se pudo guardar el catálogo.', 'error')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (item) => {
    if (
      !admin ||
      busy ||
      !(await askConfirm(`¿Eliminar el catálogo ${item.name}?`, {
        danger: true,
        confirmLabel: 'Eliminar',
      }))
    )
      return
    setBusy(true)
    try {
      await deleteDoc(doc(catalogsRef, item.id))
      setItems(previous => previous.filter(entry => entry.id !== item.id))
      if (editing === item.id) cancel()
      notify('Catálogo eliminado', 'success')
    } catch {
      notify('No se pudo eliminar el catálogo.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="business-page">
      <h2>Catálogos</h2>
      {admin && !error && !loading && (
        <form onSubmit={save}>
          <h5>{editing ? 'Editar catálogo' : 'Nuevo catálogo'}</h5>
          <fieldset disabled={busy}>
            <div className="row g-3">
              <label className="col-md-5">
                Nombre
                <input
                  required
                  maxLength="150"
                  className="form-control"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                />
              </label>
              <label className="col-md-7">
                Enlace
                <input
                  required
                  type="url"
                  className="form-control"
                  value={form.url}
                  onChange={(e) => setForm({ ...form, url: e.target.value })}
                />
              </label>
            </div>
            <div className="actions mt-3">
              <button type="submit" className="btn btn-warning">
                {busy ? 'Guardando...' : 'Guardar'}
              </button>
              {editing && (
                <button
                  type="button"
                  className="btn btn-outline-secondary"
                  onClick={cancel}
                >
                  Cancelar edición
                </button>
              )}
            </div>
          </fieldset>
        </form>
      )}
      {error ? (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      ) : loading ? (
        <p>Cargando catálogos...</p>
      ) : (
        <div className="data-panel table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Nombre</th>
                <th>Enlace</th>
                {admin && <th>Acciones</th>}
              </tr>
            </thead>
            <tbody>
              {sortedItems.map((item) => (
                <tr key={item.id}>
                  <td>{item.name}</td>
                  <td className="text-break">
                    {safeCatalogUrl(item.url) ? (
                      <a
                        href={safeCatalogUrl(item.url)}
                        target="_blank"
                        rel="noopener noreferrer"
                      >
                        {item.url}
                      </a>
                    ) : (
                      <span>Enlace no válido</span>
                    )}
                  </td>
                  {admin && (
                    <td>
                      <div className="actions">
                        <button
                          disabled={busy}
                          className="btn btn-outline-dark btn-sm"
                          onClick={() => {
                            setEditing(item.id)
                            setForm({ name: item.name, url: item.url })
                            window.scrollTo(0, 0)
                          }}
                        >
                          Editar
                        </button>
                        <button
                          disabled={busy}
                          className="btn btn-outline-danger btn-sm"
                          onClick={() => remove(item)}
                        >
                          Eliminar
                        </button>
                      </div>
                    </td>
                  )}
                </tr>
              ))}
            </tbody>
          </table>
          {!items.length && (
            <p className="empty">No hay catálogos registrados.</p>
          )}
        </div>
      )}
    </div>
  )
}
