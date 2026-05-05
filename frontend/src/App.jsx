import { BrowserRouter, Routes, Route, Link } from 'react-router-dom'
import CreateOrderPage from './pages/CreateOrderPage'
import OrdersHistoryPage from './pages/OrdersHistoryPage'

function App() {
  return (
    <BrowserRouter>
      <nav className="navbar navbar-expand-lg navbar-dark bg-dark px-4">
        <Link className="navbar-brand" to="/">
          Asistente Uniformes
        </Link>

        <div className="navbar-nav">
          <Link className="nav-link" to="/">
            Crear pedido
          </Link>

          <Link className="nav-link" to="/historial">
            Historial
          </Link>
        </div>
      </nav>

      <Routes>
        <Route path="/" element={<CreateOrderPage />} />
        <Route path="/historial" element={<OrdersHistoryPage />} />
      </Routes>
    </BrowserRouter>
  )
}

export default App