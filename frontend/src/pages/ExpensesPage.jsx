import { useEffect, useRef, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, getDocs, getFirestore, updateDoc } from 'firebase/firestore/lite'
import { db } from '../firebase/config'
import { displayOrderDate, localDateValue } from '../services/orderFormatting'
import { askConfirm } from '../services/dialogStore'
import { notify } from '../services/toastStore'

const store = getFirestore(db.app)
const ordersRef = collection(store, 'orders')
const expensesRef = collection(store, 'expenses')
const balanceStatuses = new Set(['aprobado', 'en_produccion', 'en_arreglo', 'terminado', 'entregado'])
const today = () => localDateValue(new Date())
const initial = () => ({ description: '', reference: '', amount: '', date: today() })
const cents = value => Number.isFinite(Number(value)) ? Math.round(Number(value) * 100) : 0
const quetzales = value => 'Q' + (value / 100).toFixed(2)
const inRange = (value, from, to) => {
  const date = localDateValue(value)
  return Boolean(date && (!from || date >= from) && (!to || date <= to))
}

function summarize(orders, expenses, from, to) {
  let importe = 0
  let pending = 0
  for (const order of orders) {
    if (!inRange(order.orderDate || order.createdAt, from, to)) continue
    importe += cents(order.quoteTotal)
    if (balanceStatuses.has(order.status)) pending += cents(order.balanceDue)
  }
  const funds = importe - pending
  const spent = expenses.reduce((sum, expense) => sum + cents(expense.amount), 0)
  return { funds, spent, remaining: funds - spent }
}

export default function ExpensesPage() {
  const [orders, setOrders] = useState([])
  const [expenses, setExpenses] = useState([])
  const [load, setLoad] = useState('loading')
  const [revision, setRevision] = useState(0)
  const [form, setForm] = useState(initial)
  const [editing, setEditing] = useState(null)
  const [busy, setBusy] = useState(false)
  const mutation = useRef(false)
  const formRef = useRef(null)
  const [from, setFrom] = useState(() => today().slice(0, 7) + '-01')
  const [to, setTo] = useState(today)

  useEffect(() => {
    let active = true
    Promise.all([getDocs(ordersRef), getDocs(expensesRef)]).then(([orderDocs, expenseDocs]) => {
      if (!active) return
      setOrders(orderDocs.docs.map(snapshot => snapshot.data()))
      setExpenses(expenseDocs.docs.map(snapshot => ({ ...snapshot.data(), id: snapshot.id })))
      setLoad('ready')
    }).catch(() => {
      if (active) setLoad('error')
    })
    return () => { active = false }
  }, [revision])

  const invalidRange = from && to && from > to
  const visible = expenses.filter(expense => inRange(expense.date, from, to))
    .sort((a, b) => b.date.localeCompare(a.date))
  const { funds, spent, remaining } = summarize(orders, visible, from, to)
  const cancel = () => {
    setEditing(null)
    setForm(initial())
  }

  const save = async event => {
    event.preventDefault()
    if (mutation.current) return
    const amount = cents(form.amount)
    const description = form.description.trim()
    if (!description || amount <= 0 || !localDateValue(form.date)) {
      notify('Ingresa la descripción, la fecha y un monto mayor a cero.', 'warning')
      return
    }
    mutation.current = true
    setBusy(true)
    try {
      const data = {
        description, date: form.date, amount: amount / 100,
        reference: form.reference.trim(),
        updatedAt: new Date().toISOString(),
      }
      if (editing) {
        await updateDoc(doc(expensesRef, editing), data)
        setExpenses(previous => previous.map(expense => expense.id === editing ? { ...expense, ...data } : expense))
      } else {
        const created = await addDoc(expensesRef, { ...data, createdAt: data.updatedAt })
        setExpenses(previous => [...previous, { ...data, id: created.id }])
      }
      cancel()
      notify('Gasto guardado.', 'success')
    } catch {
      notify('No se pudo guardar el gasto. Revisa la conexión y los permisos.', 'error')
    } finally {
      mutation.current = false
      setBusy(false)
    }
  }

  const remove = async expense => {
    if (mutation.current) return
    mutation.current = true
    setBusy(true)
    try {
      const confirmed = await askConfirm('¿Eliminar el gasto «' + expense.description + '»?', {
        danger: true,
        confirmLabel: 'Eliminar',
      })
      if (!confirmed) return
      await deleteDoc(doc(expensesRef, expense.id))
      setExpenses(previous => previous.filter(entry => entry.id !== expense.id))
      if (editing === expense.id) cancel()
      notify('Gasto eliminado.', 'success')
    } catch {
      notify('No se pudo eliminar el gasto.', 'error')
    } finally {
      mutation.current = false
      setBusy(false)
    }
  }

  return (
    <div className="container-fluid px-0">
      <div className="d-flex flex-wrap justify-content-between align-items-center gap-3 mb-3">
        <h2 className="page-title mb-0">Gastos</h2>
        <div className="d-flex flex-wrap gap-2" role="group" aria-label="Período">
          <label>Desde<input className="form-control" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
          <label>Hasta<input className="form-control" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
        </div>
      </div>

      {load === 'loading' && <p role="status">Cargando movimientos...</p>}
      {load === 'error' && (
        <div className="alert alert-warning" role="alert">
          No se pudieron cargar los movimientos. Revisa los permisos de Gastos en Firebase.
          <button type="button" className="btn btn-sm btn-outline-dark ms-2" onClick={() => {
            setLoad('loading')
            setRevision(value => value + 1)
          }}>Reintentar</button>
        </div>
      )}
      {invalidRange && <p className="alert alert-warning" role="alert">Desde debe ser anterior o igual a Hasta.</p>}
      {load === 'ready' && !invalidRange && (
        <>
          <div className="row g-3 mb-4">
            {[
              ['Fondos para gastos', funds],
              ['Gastos registrados', spent],
              ['Saldo disponible', remaining],
            ].map(([label, value], index) => (
              <div key={label} className="col-12 col-md-4">
                <div className={`card h-100 rounded-3 ${index === 2 ? 'border-warning bg-warning-subtle' : ''}`}>
                  <div className="card-body">
                    <div className="fw-semibold">{label}</div>
                    <strong className={`fs-3 ${value < 0 ? 'text-danger' : ''}`}>{quetzales(value)}</strong>
                    {index === 0 && <p className="small text-muted mb-0">Importe total de pedidos menos saldo pendiente por cobrar.</p>}
                  </div>
                </div>
              </div>
            ))}
          </div>

          <form ref={formRef} className="app-card p-3 p-md-4 mb-4" onSubmit={save}>
            <h3 className="h5">{editing ? 'Editar gasto' : 'Registrar gasto'}</h3>
            <fieldset disabled={busy}>
              <div className="row g-3">
                {[
                  ['description', 'Descripción', 'text', true, 2000, 'col-lg-5'],
                  ['reference', 'N.º de documento (opcional)', 'text', false, 120, 'col-lg-3'],
                  ['amount', 'Monto (Q)', 'number', true, undefined, 'col-lg-2'],
                  ['date', 'Fecha', 'date', true, undefined, 'col-lg-2'],
                ].map(([key, label, type, required, maxLength, width]) => (
                  <label key={key} className={'col-12 col-sm-6 ' + width}>
                    {label}
                    <input className="form-control" type={type} required={required} maxLength={maxLength}
                      min={type === 'number' ? '0.01' : undefined}
                      step={type === 'number' ? '0.01' : undefined}
                      value={form[key]} onChange={event => setForm(previous => ({ ...previous, [key]: event.target.value }))} />
                  </label>
                ))}
              </div>
              <div className="d-flex gap-2 mt-3">
                <button type="submit" className="btn btn-warning">Guardar gasto</button>
                {editing && <button type="button" className="btn btn-outline-secondary" onClick={cancel}>Cancelar edición</button>}
              </div>
            </fieldset>
          </form>

          <section className="app-card p-3 p-md-4">
            <h3 className="h5">Registro de gastos</h3>
            <div className="table-responsive">
              <table className="table align-middle mb-0">
                <thead><tr><th>Fecha</th><th>Descripción</th><th>N.º de documento</th><th>Monto</th><th>Acciones</th></tr></thead>
                <tbody>
                  {visible.map(expense => (
                    <tr key={expense.id}>
                      <td className="text-nowrap">{displayOrderDate(expense.date)}</td>
                      <td className="text-break">{expense.description}</td>
                      <td>{expense.reference || '—'}</td>
                      <td className="text-nowrap">{quetzales(cents(expense.amount))}</td>
                      <td>
                        <div className="d-flex flex-wrap gap-2">
                          <button type="button" className="btn btn-sm btn-outline-secondary" disabled={busy} onClick={() => {
                            setEditing(expense.id)
                            setForm({
                              description: expense.description,
                              reference: expense.reference || '',
                              date: expense.date,
                              amount: String(expense.amount),
                            })
                            formRef.current?.scrollIntoView({ block: 'nearest' })
                          }}>Editar</button>
                          <button type="button" className="btn btn-sm btn-outline-danger" disabled={busy} onClick={() => remove(expense)}>Eliminar</button>
                        </div>
                      </td>
                    </tr>
                  ))}
                  {!visible.length && <tr><td colSpan={5} className="text-muted">No hay gastos en este período.</td></tr>}
                </tbody>
              </table>
            </div>
          </section>
        </>
      )}
    </div>
  )
}
