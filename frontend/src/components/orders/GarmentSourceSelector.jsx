function GarmentSourceSelector({
  form,
  setForm,
  setAiResult,
  setPreviewBase64,
  setEditorElements
}) {
  const handleChangeSource = (source) => {
    setForm({
      ...form,

      garmentSource: source,

      productId: '',

      customerGarmentType: '',
      customerGarmentDescription: '',
      customerGarmentColor: '',

      size: '',
      quantity: 1,
      technique: '',
      customizationSide: ''
    })

    setAiResult(null)
    setPreviewBase64('')
    setEditorElements([])
  }

  return (
    <div className="garment-source-selector">
      <label className="form-label">
        Origen de la prenda
      </label>

      <div className="garment-source-options">

        <label
          className={`garment-source-option ${
            form.garmentSource === 'inventory'
              ? 'active'
              : ''
          }`}
        >
          <input
            type="radio"
            name="garmentSource"
            value="inventory"
            checked={
              form.garmentSource === 'inventory'
            }
            onChange={() =>
              handleChangeSource('inventory')
            }
          />

          <div>
            <strong>
              Producto del inventario
            </strong>

            <span>
              Selecciona una prenda disponible
              en el catálogo.
            </span>
          </div>
        </label>

        <label
          className={`garment-source-option ${
            form.garmentSource === 'customer'
              ? 'active'
              : ''
          }`}
        >
          <input
            type="radio"
            name="garmentSource"
            value="customer"
            checked={
              form.garmentSource === 'customer'
            }
            onChange={() =>
              handleChangeSource('customer')
            }
          />

          <div>
            <strong>
              Prenda proporcionada por el cliente
            </strong>

            <span>
              Registra una prenda externa
              que no pertenece al inventario.
            </span>
          </div>
        </label>

      </div>
    </div>
  )
}

export default GarmentSourceSelector