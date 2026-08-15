function InventoryGarmentForm({
  form,
  setForm,
  selectedProduct,
  inventoryProducts,
  setAiResult,
  setPreviewBase64,
  setEditorElements
}) {
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
                {product.name}
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

            {selectedProduct?.sizes.map((size) => (
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
            max={selectedProduct?.stock || undefined}
            value={form.quantity}
            onChange={(e) => {
              setForm({
                ...form,
                quantity: Number(e.target.value)
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

            {selectedProduct?.allowedTechniques.map(
              (technique) => (
                <option
                  key={technique}
                  value={technique}
                >
                  {technique}
                </option>
              )
            )}
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

            {selectedProduct?.availableSides.map((side) => (
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
              {selectedProduct.name}
            </strong>
          </div>

          <div>
            <span className="summary-label">
              Color
            </span>

            <strong>
              {selectedProduct.color}
            </strong>
          </div>

          <div>
            <span className="summary-label">
              Stock disponible
            </span>

            <strong>
              {selectedProduct.stock}
            </strong>
          </div>
        </div>
      )}
    </>
  )
}

export default InventoryGarmentForm