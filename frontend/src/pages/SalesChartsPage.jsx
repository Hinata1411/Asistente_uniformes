import { useEffect, useState } from 'react'
import { collection, getDocs, getFirestore } from 'firebase/firestore/lite'
import { db } from '../firebase/config'
import { localDateValue } from '../services/orderFormatting'
import '../styles/SalesChartsPage.css'

const salesStatuses = new Set(['aprobado', 'en_produccion', 'en_arreglo', 'terminado', 'entregado'])
const categories = [
  ['prenda', 'Prendas'],
  ['producto', 'Productos'],
  ['publicidad', 'Publicidad'],
]
const money = new Intl.NumberFormat('es-GT', { style: 'currency', currency: 'GTQ' })
const shortDate = new Intl.DateTimeFormat('es-GT', { day: 'numeric', month: 'short', timeZone: 'UTC' })
const monthLabel = new Intl.DateTimeFormat('es-GT', { month: 'short', year: 'numeric', timeZone: 'UTC' })
const dateAtUtc = key => new Date(key + 'T00:00:00Z')
const today = () => localDateValue(new Date())
const ordersRef = collection(getFirestore(db.app), 'orders')

function summarize(orders, from, to, selected) {
  const first = dateAtUtc(from)
  const last = dateAtUtc(to)
  const span = (last - first) / 86400000
  const monthly = span >= 90
  const weekly = span >= 32 && !monthly
  const grouping = monthly ? 'mes' : weekly ? 'semana' : 'día'
  const totals = new Map(categories.map(([id]) => [id, { amount: 0, count: 0 }]))
  const timeline = new Map()
  for (const order of orders) {
    const date = localDateValue(order.orderDate || order.createdAt)
    const category = order.category || 'prenda'
    if (!salesStatuses.has(order.status) || !date || date < from || date > to ||
        !totals.has(category) || (selected && selected !== category)) continue
    const quote = Number(order.quoteTotal)
    const amount = Number.isFinite(quote) && quote >= 0 ? Math.round(quote * 100) : 0
    const entry = totals.get(category)
    entry.amount += amount
    entry.count++
    const day = dateAtUtc(date)
    if (weekly) day.setUTCDate(day.getUTCDate() - (day.getUTCDay() + 6) % 7)
    const key = monthly ? date.slice(0, 7) + '-01' : day.toISOString().slice(0, 10)
    const period = timeline.get(key) || { amount: 0, count: 0 }
    period.amount += amount
    period.count++
    timeline.set(key, period)
  }
  const total = [...totals.values()].reduce((sum, item) => sum + item.amount, 0)
  const count = [...totals.values()].reduce((sum, item) => sum + item.count, 0)
  return { totals, timeline: [...timeline.entries()].sort(([a], [b]) => a.localeCompare(b)), total, count, grouping }
}

function monthlyOrders(orders, month, from, to, selected) {
  const lastDay = new Date(dateAtUtc(month + '-01'))
  lastDay.setUTCMonth(lastDay.getUTCMonth() + 1, 0)
  const counts = new Map()
  for (const order of orders) {
    const date = localDateValue(order.orderDate || order.createdAt)
    if (!date || !date.startsWith(month + '-') || date < from || date > to ||
        (selected && (order.category || 'prenda') !== selected)) continue
    counts.set(date, (counts.get(date) || 0) + 1)
  }
  return Array.from({ length: lastDay.getUTCDate() }, (_, index) => {
    const date = month + '-' + String(index + 1).padStart(2, '0')
    return { date, day: index + 1, count: date >= from && date <= to ? counts.get(date) || 0 : null }
  })
}

function MonthlyOrdersChart({ orders, from, to, selected }) {
  const month = to.slice(0, 7)
  const [activeDate, setActiveDate] = useState('')
  const days = monthlyOrders(orders, month, from, to, selected)
  const points = days.filter(day => day.count !== null)
  const count = points.reduce((sum, day) => sum + day.count, 0)
  const maximum = Math.max(1, ...points.map(day => day.count))
  const step = Math.max(1, Math.ceil(maximum / 4))
  const top = Math.ceil(maximum / step) * step
  const guides = Array.from({ length: top / step + 1 }, (_, index) => index * step)
  const x = day => 40 + (day - 1) * 486 / (days.length - 1)
  const y = value => 160 - value * 138 / top
  const line = points.map(day => x(day.day) + ',' + y(day.count)).join(' ')
  const active = points.find(day => day.date === activeDate)
  const orderLabel = value => value + (value === 1 ? ' pedido' : ' pedidos')

  return (
    <section className="app-card sales-panel sales-monthly" aria-labelledby="monthly-orders-title">
      <h3 id="monthly-orders-title" className="h5 mb-2">Pedidos registrados por día</h3>
      <p className="small text-muted mb-2">
        {orderLabel(count)} en {monthLabel.format(dateAtUtc(month + '-01'))} dentro del rango seleccionado.
      </p>
      <div className="sales-month-scroll">
        <svg viewBox="0 0 548 198" role="group" aria-label="Pedidos registrados por día del mes">
          {guides.map(value => (
            <g key={value} aria-hidden="true">
              <line x1="40" x2="526" y1={y(value)} y2={y(value)} className="sales-month-guide" />
              <text x="32" y={y(value) + 4} textAnchor="end">{value}</text>
            </g>
          ))}
          <polyline className="sales-month-line" points={line} />
          {days.map(day => (
            <text key={day.date} x={x(day.day)} y="180" textAnchor="middle"
              className={day.count === null ? 'sales-month-excluded' : undefined} aria-hidden="true">{day.day}</text>
          ))}
          {points.map(day => (
            <circle key={day.date} cx={x(day.day)} cy={y(day.count)}
              r={activeDate === day.date ? 5 : day.count ? 3.5 : 2.5}
              className="sales-month-point" tabIndex={0}
              aria-label={shortDate.format(dateAtUtc(day.date)) + ', ' + orderLabel(day.count)}
              onPointerEnter={() => setActiveDate(day.date)} onFocus={() => setActiveDate(day.date)}
              onClick={() => setActiveDate(day.date)} />
          ))}
          <text x="283" y="195" textAnchor="middle" aria-hidden="true">Día del mes</text>
        </svg>
      </div>
      {active && <p className="small mb-0 mt-2" aria-live="polite">
        {shortDate.format(dateAtUtc(active.date))} · {orderLabel(active.count)}
      </p>}
    </section>
  )
}

export default function SalesChartsPage() {
  const [orders, setOrders] = useState([])
  const [load, setLoad] = useState('loading')
  const [revision, setRevision] = useState(0)
  const [from, setFrom] = useState(() => today().slice(0, 7) + '-01')
  const [to, setTo] = useState(today)
  const [selected, setSelected] = useState('')
  const [metric, setMetric] = useState('amount')

  useEffect(() => {
    let active = true
    getDocs(ordersRef).then(snapshot => {
      if (!active) return
      setOrders(snapshot.docs.map(order => order.data()))
      setLoad('ready')
    }).catch(() => { if (active) setLoad('error') })
    return () => { active = false }
  }, [revision])

  const validRange = from && to && from <= to
  const data = summarize(validRange ? orders : [], from, to, selected)
  const max = Math.max(1, ...data.timeline.map(([, item]) => item[metric]))
  const display = item => metric === 'amount' ? money.format(item.amount / 100) : String(item.count)
  const changeMetric = event => setMetric(event.target.value)

  return (
    <div className="sales-charts">
      <header className="mb-3">
        <h2 className="page-title mb-1">Gráficas de ventas</h2>
        <p className="text-muted mb-0">Importe de pedidos aprobados y posteriores, por fecha de toma.</p>
      </header>

      <div className="app-card sales-filters mb-3">
        <label>Desde<input className="form-control" type="date" value={from} onChange={event => setFrom(event.target.value)} /></label>
        <label>Hasta<input className="form-control" type="date" value={to} onChange={event => setTo(event.target.value)} /></label>
        <label>Categoría
          <select className="form-select" value={selected} onChange={event => setSelected(event.target.value)}>
            <option value="">Todas</option>
            {categories.map(([id, label]) => <option key={id} value={id}>{label}</option>)}
          </select>
        </label>
        <label>Ver por
          <select className="form-select" value={metric} onChange={changeMetric}>
            <option value="amount">Importe</option>
            <option value="count">Cantidad de pedidos</option>
          </select>
        </label>
      </div>

      {!validRange && <p className="alert alert-warning" role="alert">Elige un rango válido de fechas.</p>}
      {load === 'loading' && <p role="status">Cargando ventas...</p>}
      {load === 'error' && (
        <div className="alert alert-warning" role="alert">
          No se pudieron cargar los pedidos.
          <button type="button" className="btn btn-sm btn-outline-dark ms-2" onClick={() => {
            setLoad('loading')
            setRevision(previous => previous + 1)
          }}>Reintentar</button>
        </div>
      )}

      {validRange && load === 'ready' && (
        <>
          <div className="sales-metrics mb-3">
            <div className="app-card sales-metric sales-metric-primary">
              <span>Importe de ventas</span>
              <strong>{money.format(data.total / 100)}</strong>
            </div>
            <div className="app-card sales-metric">
              <span>Pedidos confirmados</span>
              <strong>{data.count}</strong>
            </div>
            <div className="app-card sales-metric">
              <span>Importe promedio por pedido</span>
              <strong>{money.format(data.count ? data.total / data.count / 100 : 0)}</strong>
            </div>
          </div>

          <div className="sales-panels">
            <div className="sales-panel-stack">
              <section className="app-card sales-panel" aria-labelledby="sales-period-title">
                <h3 id="sales-period-title" className="h5">Ventas por {data.grouping}</h3>
                {data.timeline.length === 0 ? <p className="text-muted mb-0">No hay ventas en este período.</p> : (
                  <ul className="sales-periods">
                    {data.timeline.map(([key, item]) => (
                      <li className="sales-period" key={key}>
                        <time dateTime={key}>{data.grouping === 'mes' ? monthLabel.format(dateAtUtc(key))
                          : (data.grouping === 'semana' ? 'Desde ' : '') + shortDate.format(dateAtUtc(key))}</time>
                        <div className="sales-track" aria-hidden="true">
                          <span className="sales-fill" style={{ width: item[metric] / max * 100 + '%' }} />
                        </div>
                        <strong>{display(item)}</strong>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <MonthlyOrdersChart orders={orders} from={from} to={to} selected={selected} />
            </div>

            <section className="app-card sales-panel" aria-labelledby="sales-category-title">
              <h3 id="sales-category-title" className="h5">Ventas por categoría</h3>
              <ul className="sales-categories">
                {categories.filter(([id]) => !selected || id === selected).map(([id, label]) => {
                  const item = data.totals.get(id)
                  const denominator = metric === 'amount' ? data.total : data.count
                  const share = denominator ? item[metric] / denominator * 100 : 0
                  return (
                    <li key={id}>
                      <div className="d-flex justify-content-between gap-3">
                        <span>{label}</span>
                        <strong>{display(item)}</strong>
                      </div>
                      <div className="sales-track" aria-hidden="true">
                        <span className={'sales-fill sales-fill-' + id} style={{ width: share + '%' }} />
                      </div>
                      <small className="text-muted">{Math.round(share)}% · {item.count} {item.count === 1 ? 'pedido' : 'pedidos'}</small>
                    </li>
                  )
                })}
              </ul>
            </section>
          </div>
        </>
      )}
    </div>
  )
}
