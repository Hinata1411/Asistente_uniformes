function CustomerGarmentForm({
  form,
  setForm,
  setAiResult
}) {
  return (
    <div className="customer-garment-form">
      <div className="row g-3">

        {/* TIPO DE PRENDA */}
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label">
            Tipo de prenda
          </label>

          <select
            className="form-select"
            value={form.customerGarmentType}
            onChange={(e) => {
              setForm({
                ...form,
                customerGarmentType: e.target.value
              })

              setAiResult(null)
            }}
          >
            <option value="">
              Seleccione
            </option>

            <option value="playera">
              Playera
            </option>

            <option value="polo">
              Playera tipo polo
            </option>

            <option value="camisa">
              Camisa
            </option>

            <option value="columbia">
              Camisa tipo Columbia
            </option>

            <option value="jersey">
              Jersey
            </option>

            <option value="uniforme_futbol">
              Uniforme de fútbol
            </option>

            <option value="sudadera">
              Sudadera
            </option>

            <option value="chaqueta">
              Chaqueta
            </option>

            <option value="otro">
              Otro
            </option>
          </select>
        </div>

        {/* COLOR */}
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label">
            Color
          </label>

          <input
            type="text"
            className="form-control"
            placeholder="Ej. Negro"
            value={form.customerGarmentColor}
            onChange={(e) => {
              setForm({
                ...form,
                customerGarmentColor: e.target.value
              })

              setAiResult(null)
            }}
          />
        </div>

        {/* TALLA */}
        <div className="col-12 col-md-6 col-xl-2">
          <label className="form-label">
            Talla
          </label>

          <select
            className="form-select"
            value={form.size}
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

            <option value="XS">XS</option>
            <option value="S">S</option>
            <option value="M">M</option>
            <option value="L">L</option>
            <option value="XL">XL</option>
            <option value="2XL">2XL</option>
            <option value="3XL">3XL</option>
            <option value="Otro">Otra</option>
          </select>
        </div>

        {/* CANTIDAD */}
        <div className="col-12 col-md-6 col-xl-2">
          <label className="form-label">
            Cantidad
          </label>

          <input
            type="number"
            min="1"
            className="form-control"
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

            <option value="Sublimación">
              Sublimación
            </option>

            <option value="DTF">
              DTF
            </option>

            <option value="Vinil textil">
              Vinil textil
            </option>

            <option value="Bordado">
              Bordado
            </option>

            <option value="Serigrafía">
              Serigrafía
            </option>
          </select>
        </div>

        {/* ÁREA */}
        <div className="col-12 col-md-6 col-xl-3">
          <label className="form-label">
            Área a personalizar
          </label>

          <select
            className="form-select"
            value={form.customizationSide}
            onChange={(e) => {
              setForm({
                ...form,
                customizationSide: e.target.value
              })

              setAiResult(null)
            }}
          >
            <option value="">
              Seleccione
            </option>

            <option value="frente">
              Frente
            </option>

            <option value="espalda">
              Espalda
            </option>

            <option value="ambos">
              Frente y espalda
            </option>
          </select>
        </div>

        {/* DESCRIPCIÓN */}
        <div className="col-12 col-xl-6">
          <label className="form-label">
            Descripción de la prenda
          </label>

          <input
            type="text"
            className="form-control"
            placeholder="Ej. Camisa manga larga con dos bolsillos frontales"
            value={form.customerGarmentDescription}
            onChange={(e) => {
              setForm({
                ...form,
                customerGarmentDescription: e.target.value
              })

              setAiResult(null)
            }}
          />
        </div>

      </div>
    </div>
  )
}

export default CustomerGarmentForm