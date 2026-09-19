import { useEffect, useMemo, useState } from 'react'
import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase/config'
import { useAuth } from '../context/AuthContext'
import '../styles/DashboardPage.css'

const WEEKDAY_LABELS = ['L', 'M', 'M', 'J', 'V', 'S', 'D']

const MONTH_LABELS = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'
]

// Un pedido solo representa dinero real a partir de que se aprueba.
// Mientras está pendiente de aprobación no se cuenta en lo económico.
const APPROVED_ONWARD_STATUSES = [
  'aprobado',
  'en_produccion',
  'en_arreglo',
  'terminado',
  'entregado'
]

// Normaliza cualquier formato de fecha que guardamos en Firestore
// (Timestamp, string 'YYYY-MM-DD', Date, ISO string) a una llave 'YYYY-MM-DD'.
const toDateKey = (value) => {
  if (!value) return ''

  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return value
  }

  try {
    const date = typeof value.toDate === 'function'
      ? value.toDate()
      : value.seconds != null
        ? new Date(value.seconds * 1000)
        : new Date(value)

    if (!Number.isFinite(date.getTime())) return ''

    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } catch {
    return ''
  }
}

const buildCalendarDays = (monthDate) => {
  const year = monthDate.getFullYear()
  const month = monthDate.getMonth()

  const firstOfMonth = new Date(year, month, 1)
  const lastOfMonth = new Date(year, month + 1, 0)

  // getDay(): 0 = domingo ... 6 = sábado. Reacomodamos para que
  // la semana inicie en lunes (índice 0) y termine en domingo (índice 6).
  const firstWeekdayMondayIndex = (firstOfMonth.getDay() + 6) % 7

  const totalCells = Math.ceil(
    (firstWeekdayMondayIndex + lastOfMonth.getDate()) / 7
  ) * 7

  const days = []

  for (let i = 0; i < totalCells; i++) {
    const dayNumber = i - firstWeekdayMondayIndex + 1
    const date = new Date(year, month, dayNumber)

    days.push({
      date,
      key: `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`,
      inCurrentMonth: date.getMonth() === month
    })
  }

  return days
}

const getGreeting = (hour) => {
  if (hour < 12) return 'Buenos días'
  if (hour < 19) return 'Buenas tardes'
  return 'Buenas noches'
}

const getCustomerName = (order) =>
  order.customerName || order.customer?.name || 'Cliente sin nombre'

function GearIcon() {
  const teeth = Array.from({ length: 8 }, (_, i) => {
    const angle = (i * Math.PI) / 4
    const x1 = 12 + Math.cos(angle) * 7.5
    const y1 = 12 + Math.sin(angle) * 7.5
    const x2 = 12 + Math.cos(angle) * 10
    const y2 = 12 + Math.sin(angle) * 10

    return (
      <line key={i} x1={x1} y1={y1} x2={x2} y2={y2} />
    )
  })

  return (
    <svg viewBox="0 0 24 24" width="22" height="22" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="12" cy="12" r="5.5" />
      <circle cx="12" cy="12" r="1.6" fill="currentColor" stroke="none" />
      {teeth}
    </svg>
  )
}

function StatusIcon({ name }) {
  const common = {
    viewBox: '0 0 24 24',
    width: 22,
    height: 22,
    fill: 'none',
    stroke: 'currentColor',
    strokeWidth: 2,
    strokeLinecap: 'round',
    strokeLinejoin: 'round'
  }

  switch (name) {
    case 'total':
      return (
        <svg {...common}>
          <line x1="6" y1="20" x2="6" y2="12" />
          <line x1="12" y1="20" x2="12" y2="6" />
          <line x1="18" y1="20" x2="18" y2="14" />
        </svg>
      )

    case 'pendiente_aprobacion':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="12 7 12 12 15.5 13.8" />
        </svg>
      )

    case 'aprobado':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <polyline points="8 12.5 10.5 15 16 9" />
        </svg>
      )

    case 'en_produccion':
      return <GearIcon />

    case 'en_arreglo':
      return (
        <svg {...common}>
          <path d="M3 12a9 9 0 1 0 3-6.7" />
          <polyline points="3 4 3 9 8 9" />
        </svg>
      )

    case 'terminado':
      return (
        <svg {...common}>
          <path d="M5 21V4" />
          <path d="M5 4h13l-2 4.5L18 13H5" />
        </svg>
      )

    case 'entregado':
      return (
        <svg {...common}>
          <path d="M21 8.2v7.6l-9 5-9-5V8.2l9-5 9 5Z" />
          <path d="M3.3 8.2 12 13l8.7-4.8" />
          <path d="M12 13v8" />
        </svg>
      )

    case 'anulado':
      return (
        <svg {...common}>
          <circle cx="12" cy="12" r="9" />
          <line x1="9" y1="9" x2="15" y2="15" />
          <line x1="15" y1="9" x2="9" y2="15" />
        </svg>
      )

    default:
      return null
  }
}

const STATUS_CARDS = [
  {
    key: 'pendiente_aprobacion',
    label: 'Pendientes',
    className: 'stat-amber'
  },
  {
    key: 'aprobado',
    label: 'Aprobados',
    className: 'stat-indigo'
  },
  {
    key: 'en_produccion',
    label: 'En producción',
    className: 'stat-purple'
  },
  {
    key: 'terminado',
    label: 'Terminados',
    className: 'stat-teal'
  },
  {
    key: 'entregado',
    label: 'Entregados',
    className: 'stat-green'
  },
  {
    key: 'en_arreglo',
    label: 'En arreglo ',
    className: 'stat-sky'
  },
  {
    key: 'anulado',
    label: 'Anulados',
    className: 'stat-red'
  }
]

function DashboardPage() {
  const { user } = useAuth()

  const [orders, setOrders] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState('')
  const [calendarMonth, setCalendarMonth] = useState(
    () => new Date(new Date().getFullYear(), new Date().getMonth(), 1)
  )
  const [isMonthPickerOpen, setIsMonthPickerOpen] = useState(false)
  const [pickerYear, setPickerYear] = useState(
    () => new Date().getFullYear()
  )

  useEffect(() => {
    const loadOrders = async () => {
      try {
        setLoadError('')

        const querySnapshot = await getDocs(collection(db, 'orders'))

        const ordersData = querySnapshot.docs.map((docSnapshot) => ({
          id: docSnapshot.id,
          ...docSnapshot.data()
        }))

        setOrders(ordersData)
      } catch (error) {
        console.error('Error cargando pedidos para el dashboard:', error)
        setLoadError('No se pudieron cargar los pedidos. Intenta recargar la página.')
      } finally {
        setLoading(false)
      }
    }

    loadOrders()
  }, [])

  const greeting = getGreeting(new Date().getHours())

  const displayName = user?.displayName?.trim()
    ? user.displayName.trim()
    : user?.email
      ? user.email.split('@')[0]
      : 'usuario'

  const total = orders.length

  const statusCounts = useMemo(() => {
    const counts = {}

    STATUS_CARDS.forEach((card) => {
      counts[card.key] = 0
    })

    orders.forEach((order) => {
      const status = order.status || 'pendiente_aprobacion'

      if (counts[status] !== undefined) {
        counts[status] += 1
      }
    })

    return counts
  }, [orders])

  const economicSummary = useMemo(() => {
    // Solo lo aprobado en adelante representa dinero real: un pedido
    // pendiente de aprobación todavía no compromete ningún cobro.
    const approvedOrders = orders.filter((order) =>
      APPROVED_ONWARD_STATUSES.includes(order.status)
    )

    const quotedTotal = approvedOrders.reduce(
      (sum, order) => sum + (Number(order.quoteTotal) || 0),
      0
    )

    const pendingBalance = approvedOrders.reduce(
      (sum, order) => sum + (Number(order.balanceDue) || 0),
      0
    )

    return { quotedTotal, pendingBalance }
  }, [orders])

  const ordersByDay = useMemo(() => {
    const map = {}

    orders.forEach((order) => {
      const key = toDateKey(order.orderDate || order.createdAt)
      if (!key) return

      if (!map[key]) map[key] = []
      map[key].push(order)
    })

    return map
  }, [orders])

  const deliveriesByDay = useMemo(() => {
    const map = {}

    orders.forEach((order) => {
      if (order.status === 'anulado') return

      // Si el pedido ya se entregó, se ubica en el calendario en la
      // fecha real de entrega (deliveredAt) y no en la fecha que
      // originalmente se había previsto, para que no quede "atrasado"
      // en el calendario cuando en realidad ya se entregó otro día.
      const dateSource =
        order.status === 'entregado' && order.deliveredAt
          ? order.deliveredAt
          : order.expectedDeliveryDate

      const key = toDateKey(dateSource)
      if (!key) return

      if (!map[key]) map[key] = []
      map[key].push(order)
    })

    return map
  }, [orders])

  const calendarDays = useMemo(
    () => buildCalendarDays(calendarMonth),
    [calendarMonth]
  )

  const calendarWeeks = useMemo(() => {
    const weeks = []

    for (let i = 0; i < calendarDays.length; i += 7) {
      weeks.push(calendarDays.slice(i, i + 7))
    }

    return weeks
  }, [calendarDays])

  const todayKey = toDateKey(new Date())

  const goToPreviousMonth = () => {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() - 1, 1)
    )
  }

  const goToNextMonth = () => {
    setCalendarMonth(
      (current) => new Date(current.getFullYear(), current.getMonth() + 1, 1)
    )
  }

  const goToCurrentMonth = () => {
    const now = new Date()
    setCalendarMonth(new Date(now.getFullYear(), now.getMonth(), 1))
  }

  const openMonthPicker = () => {
    setPickerYear(calendarMonth.getFullYear())
    setIsMonthPickerOpen(true)
  }

  const closeMonthPicker = () => setIsMonthPickerOpen(false)

  const pickMonth = (monthIndex) => {
    setCalendarMonth(new Date(pickerYear, monthIndex, 1))
    setIsMonthPickerOpen(false)
  }

  const goToTodayFromPicker = () => {
    goToCurrentMonth()
    setIsMonthPickerOpen(false)
  }

  return (
    <div className="dashboard-page">
      <div className="dashboard-header">
        <h2 className="page-title">
          Hola, {greeting.toLowerCase()}
        </h2>
        <p className="page-subtitle">
          {displayName}, este es el resumen de hoy.
        </p>
      </div>

      {loadError && (
        <div className="alert alert-danger">{loadError}</div>
      )}

      <div className="econ-grid">
        <div className="econ-card">
          <span>Total cotizado (pedidos aprobados)</span>
          <strong>Q{economicSummary.quotedTotal.toFixed(2)}</strong>
        </div>

        <div className="econ-card econ-card-balance">
          <span>Saldo pendiente por cobrar</span>
          <strong>Q{economicSummary.pendingBalance.toFixed(2)}</strong>
        </div>
      </div>

      <div className="stat-grid">
        <div className="stat-card stat-total">
          <div className="stat-card-icon">
            <StatusIcon name="total" />
          </div>

          <div className="stat-card-body">
            <span className="stat-card-label">Total de pedidos</span>
            <strong className="stat-card-value">
              {loading ? '—' : total}
            </strong>
          </div>
        </div>

        {STATUS_CARDS.map((card) => (
          <div
            key={card.key}
            className={`stat-card ${card.className}`}
          >
            <div className="stat-card-icon">
              <StatusIcon name={card.key} />
            </div>

            <div className="stat-card-body">
              <span className="stat-card-label">{card.label}</span>
              <strong className="stat-card-value">
                {loading ? '—' : statusCounts[card.key]}
              </strong>
            </div>
          </div>
        ))}
      </div>

      <div className="calendar-card">
        <div className="calendar-header">
          <h3>Calendario de pedidos</h3>

          <div className="calendar-nav">
            <button
              type="button"
              className="calendar-nav-btn"
              onClick={goToPreviousMonth}
              aria-label="Mes anterior"
            >
              ‹
            </button>

            <div className="calendar-month-picker">
              <button
                type="button"
                className="calendar-nav-month"
                onClick={openMonthPicker}
              >
                {MONTH_LABELS[calendarMonth.getMonth()]} {calendarMonth.getFullYear()}
              </button>

              {isMonthPickerOpen && (
                <>
                  <div
                    className="calendar-picker-backdrop"
                    onClick={closeMonthPicker}
                  />

                  <div className="calendar-picker">
                    <div className="calendar-picker-year">
                      <button
                        type="button"
                        onClick={() => setPickerYear((year) => year - 1)}
                        aria-label="Año anterior"
                      >
                        ‹
                      </button>

                      <strong>{pickerYear}</strong>

                      <button
                        type="button"
                        onClick={() => setPickerYear((year) => year + 1)}
                        aria-label="Año siguiente"
                      >
                        ›
                      </button>
                    </div>

                    <div className="calendar-picker-months">
                      {MONTH_LABELS.map((label, index) => (
                        <button
                          type="button"
                          key={label}
                          className={
                            index === calendarMonth.getMonth() &&
                            pickerYear === calendarMonth.getFullYear()
                              ? 'is-active'
                              : ''
                          }
                          onClick={() => pickMonth(index)}
                        >
                          {label.slice(0, 3)}
                        </button>
                      ))}
                    </div>

                    <button
                      type="button"
                      className="calendar-picker-today"
                      onClick={goToTodayFromPicker}
                    >
                      Ir a hoy
                    </button>
                  </div>
                </>
              )}
            </div>

            <button
              type="button"
              className="calendar-nav-btn"
              onClick={goToNextMonth}
              aria-label="Mes siguiente"
            >
              ›
            </button>
          </div>
        </div>

        <div className="calendar-legend">
          <span className="calendar-legend-item">
            <span className="calendar-legend-dot calendar-legend-dot-orders" />
            Pedidos registrados
          </span>

          <span className="calendar-legend-item">
            <span className="calendar-legend-dot calendar-legend-dot-delivery" />
            Fecha de entrega
          </span>
        </div>

        <div className="calendar-weekdays">
          {WEEKDAY_LABELS.map((label, index) => (
            <span key={`${label}-${index}`}>{label}</span>
          ))}
        </div>

        <div className="calendar-grid">
          {calendarWeeks.map((week, weekIndex) => (
            <div className="calendar-week" key={weekIndex}>
              {week.map((day, dayIndex) => {
                const dayOrders = ordersByDay[day.key] || []
                const dayDeliveries = deliveriesByDay[day.key] || []
                const hasData = dayOrders.length > 0 || dayDeliveries.length > 0

                return (
                  <div
                    key={day.key}
                    className={[
                      'calendar-day',
                      day.inCurrentMonth ? '' : 'is-outside',
                      day.key === todayKey ? 'is-today' : '',
                      hasData ? 'has-data' : '',
                      dayIndex === 0 ? 'is-first-col' : '',
                      dayIndex === week.length - 1 ? 'is-last-col' : ''
                    ].join(' ').trim()}
                  >
                    <span className="calendar-day-number">
                      {day.date.getDate()}
                    </span>

                    {hasData && (
                      <div className="calendar-day-markers">
                        {dayOrders.length > 0 && (
                          <span className="calendar-marker calendar-marker-orders">
                            {dayOrders.length}
                          </span>
                        )}

                        {dayDeliveries.length > 0 && (
                          <span className="calendar-marker calendar-marker-delivery">
                            {dayDeliveries.length}
                          </span>
                        )}
                      </div>
                    )}

                    {hasData && (
                      <div className="calendar-day-tooltip">
                        {dayOrders.length > 0 && (
                          <div className="tooltip-section">
                            <p className="tooltip-title">
                              <span className="calendar-legend-dot calendar-legend-dot-orders" />
                              {dayOrders.length} pedido{dayOrders.length === 1 ? '' : 's'} registrado{dayOrders.length === 1 ? '' : 's'}
                            </p>

                            <ul>
                              {dayOrders.slice(0, 3).map((order) => (
                                <li key={order.id}>{getCustomerName(order)}</li>
                              ))}

                              {dayOrders.length > 3 && (
                                <li>+{dayOrders.length - 3} más</li>
                              )}
                            </ul>
                          </div>
                        )}

                        {dayDeliveries.length > 0 && (
                          <div className="tooltip-section">
                            <p className="tooltip-title">
                              <span className="calendar-legend-dot calendar-legend-dot-delivery" />
                              {dayDeliveries.length} entrega{dayDeliveries.length === 1 ? '' : 's'}
                            </p>

                            <ul>
                              {dayDeliveries.slice(0, 3).map((order) => (
                                <li key={order.id}>{getCustomerName(order)}</li>
                              ))}

                              {dayDeliveries.length > 3 && (
                                <li>+{dayDeliveries.length - 3} más</li>
                              )}
                            </ul>
                          </div>
                        )}
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export default DashboardPage