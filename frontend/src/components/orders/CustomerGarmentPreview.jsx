function CustomerGarmentPreview({
  form,
  onImageChange
}) {
  const handleImageUpload = (event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!file.type.startsWith('image/')) {
      alert('Selecciona un archivo de imagen válido.')
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      onImageChange(reader.result)
    }

    reader.readAsDataURL(file)
  }

  return (
    <div className="customer-garment-preview">

      <div className="mb-3">
        <label className="form-label">
          Fotografía de la prenda
        </label>

        <input
          type="file"
          className="form-control"
          accept="image/*"
          onChange={handleImageUpload}
        />

        <div className="form-text mt-2">
          Sube una fotografía clara de la prenda proporcionada
          por el cliente para utilizarla como base de la
          personalización.
        </div>
      </div>

      <div className="customer-garment-details">
        <div>
          <span className="summary-label">
            Tipo de prenda
          </span>

          <strong>
            {form.customerGarmentType || 'No especificado'}
          </strong>
        </div>

        <div>
          <span className="summary-label">
            Color
          </span>

          <strong>
            {form.customerGarmentColor || 'No especificado'}
          </strong>
        </div>

        <div>
          <span className="summary-label">
            Talla
          </span>

          <strong>
            {form.size || 'No especificada'}
          </strong>
        </div>
      </div>

    </div>
  )
}

export default CustomerGarmentPreview