function OrderAIValidationDetails({ validation, validatedAt }) {
  if (!validation) {
    return (
      <div className="alert alert-secondary mt-3 mb-0">
        Este pedido no tiene una validación del asistente almacenada.
      </div>
    )
  }

  const riskLevel = validation.riskLevel || 'No definido'

  const riskClass =
    riskLevel === 'alto'
      ? 'bg-danger'
      : riskLevel === 'medio'
        ? 'bg-warning text-dark'
        : 'bg-success'

  const formattedDate = validatedAt
    ? new Date(validatedAt).toLocaleString()
    : 'No disponible'

  return (
    <div className="card mt-3 border-primary">
      <div className="card-body">
        <div className="d-flex justify-content-between align-items-center mb-3">
          <h6 className="mb-0">
            Validación del asistente inteligente
          </h6>

          <span className={`badge ${riskClass}`}>
            Riesgo {riskLevel}
          </span>
        </div>

        <p className="mb-2">
          <strong>Compatibilidad técnica:</strong>{' '}
          {validation.techniqueCompatibility || 'No disponible'}
        </p>

        <p className="mb-2">
          <strong>Ubicación detectada:</strong>{' '}
          {validation.detectedPlacement || 'No disponible'}
        </p>

        <p className="mb-2">
          <strong>Proporción visual:</strong>{' '}
          {validation.visualFit || 'No disponible'}
        </p>

        <p className="mb-2">
          <strong>Recomendación:</strong>{' '}
          {validation.recommendation || 'No disponible'}
        </p>

        <p className="mb-2">
          <strong>Nota para producción:</strong>{' '}
          {validation.productionNote || 'No disponible'}
        </p>

        <p className="mb-2">
          <strong>Fecha de validación:</strong>{' '}
          {formattedDate}
        </p>

        <div className="mt-3">
          <strong>Advertencias:</strong>

          {Array.isArray(validation.warnings) &&
          validation.warnings.length > 0 ? (
            <ul className="mb-0 mt-1">
              {validation.warnings.map((warning, index) => (
                <li key={index}>{warning}</li>
              ))}
            </ul>
          ) : (
            <p className="text-muted mb-0 mt-1">
              Sin advertencias registradas.
            </p>
          )}
        </div>
      </div>
    </div>
  )
}

export default OrderAIValidationDetails