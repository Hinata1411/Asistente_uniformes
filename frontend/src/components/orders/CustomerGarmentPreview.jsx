import { notify } from '../../services/toastStore'

function CustomerGarmentPreview({
  form,
  images,
  onImageChange
}) {
  const handleImageUpload = (side, event) => {
    const file = event.target.files?.[0]

    if (!file) {
      return
    }

    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) {
      notify('Selecciona un archivo de imagen válido.', 'warning')
      return
    }

    if (file.size > 5 * 1024 * 1024) {
      notify('Cada fotografía debe pesar menos de 5 MB.', 'warning')
      event.target.value = ''
      return
    }

    const reader = new FileReader()

    reader.onload = () => {
      onImageChange(side, reader.result)
    }

    reader.readAsDataURL(file)
  }

  return (
    <div className="customer-garment-preview">

      <div className="row g-3 mb-3">
        <div className="col-12 col-md-6">
        <label className="form-label">
          Fotografía de frente
        </label>

        <input
          type="file"
          className="form-control"
          accept="image/jpeg,image/png,image/webp"
          onChange={(event) => handleImageUpload('front', event)}
        />
        {images?.front && <img src={images.front} alt="Vista previa de la prenda de frente" className="img-thumbnail mt-2" style={{ maxHeight: 150 }} />}
        </div>

        <div className="col-12 col-md-6">
          <label className="form-label">
            Fotografía de espalda
          </label>
          <input
            type="file"
            className="form-control"
            accept="image/jpeg,image/png,image/webp"
            onChange={(event) => handleImageUpload('back', event)}
          />
          {images?.back && <img src={images.back} alt="Vista previa de la prenda de espalda" className="img-thumbnail mt-2" style={{ maxHeight: 150 }} />}
        </div>
        <div className="form-text mt-2">
          Si personalizarás ambos lados, carga una foto diferente de frente y otra de espalda.
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
