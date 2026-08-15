function InventoryGarmentForm({
  form,
  setForm,
  selectedProduct,
  inventoryProducts = [],
  setAiResult,
  setPreviewBase64,
  setEditorElements
}) {
  const sizes = Array.isArray(selectedProduct?.sizes)
    ? selectedProduct.sizes
    : []

  const techniques = Array.isArray(
    selectedProduct?.allowedTechniques
  )
    ? selectedProduct.allowedTechniques
    : []

  const availableSides = Array.isArray(
    selectedProduct?.availableSides
  )
    ? selectedProduct.availableSides
    : []

  return (
    <>
      <div className="row g-3">

        {/* PRODUCTO */}
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label">
            Producto
          </label>

          <select
            className="form-select"
            value={form.productId}
            onChange={(e) => {
              setForm({
                ...form,
                productId: e.target.value,
                size: '',
                technique: '',
                customizationSide: ''
              })

              setAiResult(null)
              setPreviewBase64('')
              setEditorElements([])
            }}
          >
            <option value="">
              Seleccione
            </option>

            {inventoryProducts.map((product) => (
              <option
                key={product.id}
                value={product.id}
              >
                {product.name || 'Producto sin nombre'}
                {Number(product.stock || 0) <= 0
                  ? ' - Agotado'
                  : ` - Stock: ${Number(product.stock || 0)}`}
              </option>
            ))}
          </select>
        </div>

        {/* TALLA */}
        <div className="col-12 col-md-6 col-xl-2">
          <label className="form-label">
            Talla
          </label>

          <select
            className="form-select"
            value={form.size}
            disabled={!selectedProduct}
            onChange={(e) => {
              setForm({
                ...form,
                size: e.target.value
              })

              setAiResult(null)
            }}
          >
            <option value="">
              Seleccione
            </option>

            {sizes.map((size) => (
              <option
                key={size}
                value={size}
              >
                {size}
              </option>
            ))}
          </select>
        </div>

        {/* CANTIDAD */}
        <div className="col-12 col-md-6 col-xl-2">
          <label className="form-label">
            Cantidad
          </label>

          <input
            type="number"
            className="form-control"
            min="1"
            max={
              Number(selectedProduct?.stock || 0) > 0
                ? Number(selectedProduct.stock)
                : undefined
            }
            value={form.quantity}
            disabled={!selectedProduct}
            onChange={(e) => {
              const value = Number(e.target.value)

              setForm({
                ...form,
                quantity: value
              })

              setAiResult(null)
            }}
          />
        </div>

        {/* TÉCNICA */}
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label">
            Técnica
          </label>

          <select
            className="form-select"
            value={form.technique}
            disabled={!selectedProduct}
            onChange={(e) => {
              setForm({
                ...form,
                technique: e.target.value
              })

              setAiResult(null)
            }}
          >
            <option value="">
              Seleccione
            </option>

            {techniques.map((technique) => (
              <option
                key={technique}
                value={technique}
              >
                {technique}
              </option>
            ))}
          </select>
        </div>

        {/* ÁREA */}
        <div className="col-12 col-md-6 col-xl-2">
          <label className="form-label">
            Área
          </label>

          <select
            className="form-select"
            value={form.customizationSide}
            disabled={!selectedProduct}
            onChange={(e) => {
              setForm({
                ...form,
                customizationSide: e.target.value
              })

              setAiResult(null)
              setPreviewBase64('')
            }}
          >
            <option value="">
              Seleccione
            </option>

            {availableSides.map((side) => (
              <option
                key={side}
                value={side}
              >
                {side === 'frente'
                  ? 'Frente'
                  : side === 'espalda'
                    ? 'Espalda'
                    : 'Frente y espalda'}
              </option>
            ))}
          </select>
        </div>

      </div>

      {selectedProduct && (
        <div className="selected-product-summary">

          <div>
            <span className="summary-label">
              Producto seleccionado
            </span>

            <strong>
              {selectedProduct.name || 'No definido'}
            </strong>
          </div>

          <div>
            <span className="summary-label">
              Color
            </span>

            <strong>
              {selectedProduct.color || 'No definido'}
            </strong>
          </div>

          <div>
            <span className="summary-label">
              Stock disponible
            </span>

            <strong>
              {Number(selectedProduct.stock || 0)}
            </strong>
          </div>

        </div>
      )}

      {selectedProduct &&
        sizes.length === 0 && (
          <div className="alert alert-warning mt-3">
            Este producto no tiene tallas configuradas.
          </div>
        )}

      {selectedProduct &&
        techniques.length === 0 && (
          <div className="alert alert-warning mt-3">
            Este producto no tiene técnicas de personalización configuradas.
          </div>
        )}

      {selectedProduct &&
        availableSides.length === 0 && (
          <div className="alert alert-warning mt-3">
            Este producto no tiene áreas de personalización configuradas.
          </div>
        )}
    </>
  )
}

export default InventoryGarmentForm