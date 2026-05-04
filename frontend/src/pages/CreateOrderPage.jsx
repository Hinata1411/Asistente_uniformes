import GarmentEditor from '../components/GarmentEditor'

function CreateOrderPage() {
  return (
    <div className="container mt-4">
      <h2>Crear Pedido Personalizado</h2>
      <p className="text-muted">
        Selecciona una prenda y visualiza el diseño del cliente.
      </p>

      <GarmentEditor />
    </div>
  )
}

export default CreateOrderPage