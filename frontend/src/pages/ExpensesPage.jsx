import { useEffect, useState } from 'react'
import {
  collection,
  onSnapshot,
  addDoc,
  updateDoc,
  deleteDoc,
  doc,
} from 'firebase/firestore'
import { db } from '../firebase/config'
import {
  financialTotals,
  monthStart,
  today,
  validAmount,
  money,
} from '../services/businessModel'
import { localDateValue, displayOrderDate } from '../services/orderFormatting'
import { notify } from '../services/toastStore'
import { askConfirm } from '../services/dialogStore'
import '../styles/BusinessPages.css'
const initial = () => ({
  description: '',
  amount: '',
  date: today(),
  provider: '',
  reference: '',
  paymentMethod: '',
  notes: '',
})
export default function ExpensesPage() {
  const [expenses, setExpenses] = useState([]),
    [orders, setOrders] = useState([]),
    [loaded, setLoaded] = useState({}),
    [error, setError] = useState(''),
    [form, setForm] = useState(initial),
    [editing, setEditing] = useState(null),
    [busy, setBusy] = useState(false),
    [from, setFrom] = useState(monthStart),
    [to, setTo] = useState(today),
    [mode, setMode] = useState('quoted')
  useEffect(() => {
    const subscriptions = [
      ['expenses', setExpenses],
      ['orders', setOrders],
    ].map(([name, set]) =>
      onSnapshot(
        collection(db, name),
        (snap) => {
          set(snap.docs.map((d) => ({ ...d.data(), id: d.id })))
          setLoaded((prev) => ({ ...prev, [name]: true }))
        },
        () =>
          setError(
            'No se pudieron consultar los movimientos. Revisa tu conexión y permisos.',
          ),
      ),
    )
    return () => subscriptions.forEach((stop) => stop())
  }, [])
  const invalidRange = from && to && from > to
  const totals = financialTotals(
    orders.map((o) => ({
      ...o,
      orderDate: localDateValue(o.orderDate || o.createdAt),
    })),
    expenses,
    from,
    to,
    mode,
  )
  const filtered = expenses
    .filter((e) => (!from || e.date >= from) && (!to || e.date <= to))
    .sort((a, b) => b.date.localeCompare(a.date))
  const cancel = () => {
    setEditing(null)
    setForm(initial())
  }
  const save = async (e) => {
    e.preventDefault()
    if (busy) return
    if (
      !form.description.trim() ||
      !validAmount(form.amount) ||
      money(form.amount) <= 0 ||
      !localDateValue(form.date)
    ) {
      notify('Ingresa descripción, fecha y un monto mayor a cero.', 'warning')
      return
    }
    setBusy(true)
    try {
      const data = {
        description: form.description.trim(),
        amount: money(form.amount),
        date: form.date,
        provider: form.provider,
        reference: form.reference,
        paymentMethod: form.paymentMethod,
        notes: form.notes,
        updatedAt: new Date().toISOString(),
      }
      if (editing) await updateDoc(doc(db, 'expenses', editing), data)
      else
        await addDoc(collection(db, 'expenses'), {
          ...data,
          createdAt: new Date().toISOString(),
        })
      cancel()
      notify('Gasto guardado', 'success')
    } catch {
      notify('No se pudo guardar el gasto.', 'error')
    } finally {
      setBusy(false)
    }
  }
  const remove = async (expense) => {
    if (
      busy ||
      !(await askConfirm(`¿Eliminar el gasto ${expense.description}?`, {
        danger: true,
        confirmLabel: 'Eliminar',
      }))
    )
      return
    setBusy(true)
    try {
      await deleteDoc(doc(db, 'expenses', expense.id))
      if (editing === expense.id) cancel()
      notify('Gasto eliminado', 'success')
    } catch {
      notify('No se pudo eliminar el gasto.', 'error')
    } finally {
      setBusy(false)
    }
  }
  return (
    <div className="business-page">
      <h2>Gastos</h2>
      <div className="data-panel">
        <div className="row g-3">
          <label className="col-md-4">
            Desde
            <input
              type="date"
              className="form-control"
              value={from}
              onChange={(e) => setFrom(e.target.value)}
            />
          </label>
          <label className="col-md-4">
            Hasta
            <input
              type="date"
              className="form-control"
              value={to}
              onChange={(e) => setTo(e.target.value)}
            />
          </label>
          <label className="col-md-4">
            Monto de pedidos
            <select
              className="form-select"
              value={mode}
              onChange={(e) => setMode(e.target.value)}
            >
              <option value="quoted">Total cotizado</option>
              <option value="paid">Total cobrado</option>
            </select>
          </label>
        </div>
        <p className="form-text mt-2">
          Pedidos por fecha de toma y gastos por fecha del gasto. Se excluyen
          pedidos anulados.
        </p>
      </div>
      {error ? (
        <div role="alert" className="alert alert-danger">
          {error}
        </div>
      ) : invalidRange ? (
        <div role="alert" className="alert alert-warning">
          Desde no puede ser posterior a Hasta.
        </div>
      ) : !loaded.orders || !loaded.expenses ? (
        <p>Cargando movimientos...</p>
      ) : (
        <div className="business-metrics">
          {[
            [
              mode === 'paid'
                ? 'Cobrado de pedidos del período'
                : 'Total cotizado de pedidos',
              totals.income,
            ],
            ['Total de gastos', totals.expenses],
            [
              mode === 'paid'
                ? 'Cobrado menos gastos'
                : 'Cotizado menos gastos',
              totals.remainder,
            ],
          ].map(([label, value]) => (
            <article key={label}>
              <span>{label}</span>
              <strong>Q{value.toFixed(2)}</strong>
            </article>
          ))}
        </div>
      )}
      <form onSubmit={save}>
        <h5>{editing ? 'Editar gasto' : 'Registrar gasto'}</h5>
        <fieldset disabled={busy}>
          <div className="row g-3">
            {[
              ['description', 'Descripción', 'text'],
              ['amount', 'Monto (Q)', 'number'],
              ['date', 'Fecha', 'date'],
              ['provider', 'Proveedor o beneficiario', 'text'],
              ['reference', 'Comprobante o referencia', 'text'],
              ['paymentMethod', 'Forma de pago', 'text'],
            ].map(([key, label, type]) => (
              <label key={key} className="col-md-6">
                {label}
                <input
                  className="form-control"
                  type={type}
                  min={type === 'number' ? '0.01' : undefined}
                  step={type === 'number' ? '0.01' : undefined}
                  required={['description', 'amount', 'date'].includes(key)}
                  value={form[key]}
                  onChange={(e) => setForm({ ...form, [key]: e.target.value })}
                />
              </label>
            ))}
            <label className="col-12">
              Información adicional
              <textarea
                className="form-control"
                value={form.notes}
                onChange={(e) => setForm({ ...form, notes: e.target.value })}
              />
            </label>
          </div>
          <div className="actions mt-3">
            <button className="btn btn-warning" type="submit">
              {busy ? 'Guardando...' : 'Guardar gasto'}
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
      {!error && !invalidRange && loaded.expenses && (
        <div className="data-panel table-responsive">
          <table className="table">
            <thead>
              <tr>
                <th>Fecha</th>
                <th>Descripción</th>
                <th>Monto</th>
                <th>Información</th>
                <th>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {filtered.map((e) => (
                <tr key={e.id}>
                  <td>{displayOrderDate(e.date)}</td>
                  <td>{e.description}</td>
                  <td>Q{Number(e.amount).toFixed(2)}</td>
                  <td>
                    {[e.provider, e.reference, e.paymentMethod, e.notes]
                      .filter(Boolean)
                      .join(' · ')}
                  </td>
                  <td>
                    <div className="actions">
                      <button
                        className="btn btn-sm btn-outline-dark"
                        disabled={busy}
                        onClick={() => {
                          setEditing(e.id)
                          setForm({
                            ...initial(),
                            ...e,
                            amount: String(e.amount),
                          })
                          window.scrollTo(0, 0)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        className="btn btn-sm btn-outline-danger"
                        disabled={busy}
                        onClick={() => remove(e)}
                      >
                        Eliminar
                      </button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
          {!filtered.length && (
            <p className="empty">No hay gastos para este período.</p>
          )}
        </div>
      )}
    </div>
  )
}
