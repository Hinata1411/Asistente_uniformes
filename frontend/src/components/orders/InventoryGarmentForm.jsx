function InventoryGarmentForm({
  form,
  setForm,
  selectedProduct,
  inventoryProducts = [],
  setAiResult,
  setPreviewBase64,
  setEditorElements
}) {
  console.log(
  'PRODUCTO RECIBIDO EN InventoryGarmentForm:',
  selectedProduct
)

console.log(
  'TALLAS RECIBIDAS:',
  selectedProduct?.sizes
)

console.log(
  'TECNICAS RECIBIDAS:',
  selectedProduct?.allowedTechniques
)

console.log(
  'AREAS RECIBIDAS:',
  selectedProduct?.availableSides
)
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
              const newProductId = e.target.value

              const newProduct = inventoryProducts.find(
                (item) => item.id === newProductId
              )

              /*
                Cada producto solo maneja una talla (no se
                soportan variantes), así que la traemos
                automáticamente en cuanto se elige el producto.
              */
              const newProductSizes = Array.isArray(
                newProduct?.sizes
              )
                ? newProduct.sizes
                : []

              setForm({
                ...form,
                productId: newProductId,
                size: newProductSizes[0] || '',
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

            {inventoryProducts.map((product) => {
              const productSizes = Array.isArray(product.sizes)
                ? product.sizes
                : []

              const stockLabel =
                Number(product.stock || 0) <= 0
                  ? 'Agotado'
                  : `Stock: ${Number(product.stock || 0)}`

              return (
                <option
                  key={product.id}
                  value={product.id}
                >
                  {[
                    product.name || 'Producto sin nombre',
                    product.color || 'sin color',
                    productSizes[0]
                      ? `Talla ${productSizes[0]}`
                      : 'sin talla',
                    stockLabel
                  ].join(' / ')}
                </option>
              )
            })}
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
            /*
              La talla viene fija del producto (una sola
              por producto), así que aquí solo se muestra,
              no se elige.
            */
            disabled={!selectedProduct || sizes.length <= 1}
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