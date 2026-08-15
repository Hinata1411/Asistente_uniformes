const VALID_TECHNIQUES = [
  'DTF',
  'Bordado',
  'Sublimación',
  'Vinil textil',
  'Serigrafía'
]

const VALID_SIDES = [
  'frente',
  'espalda',
  'ambos'
]

const normalizeText = (value) => {
  if (!value) return ''

  return String(value).trim()
}

const normalizeKey = (value) => {
  if (!value) return ''

  return String(value)
    .trim()
    .toLowerCase()
}

/*
  Valida únicamente reglas generales del pedido.

  IMPORTANTE:
  El tipo de prenda NO se restringe a un catálogo fijo,
  porque el sistema permite prendas proporcionadas
  directamente por el cliente.
*/
export const validateBasicRules = ({
  garmentSource,
  product,
  productType,
  size,
  technique,
  quantity,
  customizationSide
}) => {
  const warnings = []

  let riskLevel = 'bajo'
  let isTechniqueRecommended = true

  const normalizedSource =
    normalizeKey(garmentSource)

  const normalizedType =
    normalizeKey(productType)

  if (
    !['inventory', 'customer'].includes(
      normalizedSource
    )
  ) {
    warnings.push(
      'El origen de la prenda no es válido.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!product) {
    warnings.push(
      'No se recibió información de la prenda.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  /*
    No usamos una lista como:
    ['jersey', 'pantalon', 'kit']

    Solo verificamos que exista un tipo de prenda.
  */
  if (!normalizedType) {
    warnings.push(
      'Debe especificarse el tipo de prenda.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!size) {
    warnings.push(
      'Debe seleccionar una talla.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (
    !VALID_TECHNIQUES.includes(
      technique
    )
  ) {
    warnings.push(
      'La técnica seleccionada no es válida.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (
    !VALID_SIDES.includes(
      normalizeKey(customizationSide)
    )
  ) {
    warnings.push(
      'Debe seleccionar frente, espalda o ambos.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (
    !quantity ||
    Number(quantity) <= 0
  ) {
    warnings.push(
      'La cantidad debe ser mayor a 0.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  return {
    hasBlockingError:
      riskLevel === 'alto',

    result: {
      riskLevel,

      isTechniqueRecommended,

      techniqueCompatibility:
        isTechniqueRecommended
          ? 'La técnica puede continuar a revisión visual.'
          : 'La técnica o los datos del pedido necesitan corrección.',

      detectedPlacement:
        customizationSide ||
        'zona no seleccionada',

      recommendedSizes: [],

      productionColors: [],

      visualFit:
        'Pendiente de revisión.',

      customElementsDetected: [],

      recommendation:
        isTechniqueRecommended
          ? 'El pedido puede continuar a validación visual con IA.'
          : 'El pedido necesita corrección antes de continuar.',

      clientMessage:
        isTechniqueRecommended
          ? 'Su pedido será revisado visualmente antes de enviarse a producción.'
          : 'Su pedido necesita ajustes antes de continuar.',

      productionNote:
        'Validar la prenda, técnica, diseño, ubicación y calidad antes de producción.',

      warnings
    }
  }
}

export const completeAIResult = (
  result,
  fallback = {}
) => {
  const completed = {
    riskLevel:
      result?.riskLevel ||
      fallback.riskLevel ||
      'medio',

    isTechniqueRecommended:
      typeof result?.isTechniqueRecommended === 'boolean'
        ? result.isTechniqueRecommended
        : fallback.isTechniqueRecommended ?? true,

    techniqueCompatibility:
      normalizeText(
        result?.techniqueCompatibility
      ) ||
      `La técnica ${
        fallback.technique || 'seleccionada'
        } debe revisarse según los elementos personalizados.`,
      
    detectedPlacement:
      result?.detectedPlacement ||
      `Diseño agregado en ${
        fallback.customizationSide ||
        'la zona seleccionada'
      }.`,

    recommendedSizes:
      Array.isArray(result?.recommendedSizes)
        ? result.recommendedSizes
        : [],

    productionColors:
      Array.isArray(result?.productionColors)
        ? result.productionColors
        : [],

    visualFit:
      result?.visualFit ||
      'La proporción visual debe confirmarse antes de producción.',

    customElementsDetected:
      Array.isArray(result?.customElementsDetected)
        ? result.customElementsDetected
        : fallback.customElementsDetected || [],

    recommendation:
      result?.recommendation ||
      'Revisar tamaño, ubicación y técnica antes de aprobar.',

    clientMessage:
      result?.clientMessage ||
      'Su diseño fue recibido y será revisado antes de producción.',

    productionNote:
      result?.productionNote ||
      'Validar técnica, tamaño, ubicación, colores y calidad antes de producir.',

    warnings:
      Array.isArray(result?.warnings)
        ? result.warnings
        : []
  }

  if (
    !['bajo', 'medio', 'alto'].includes(
      completed.riskLevel
    )
  ) {
    completed.riskLevel = 'medio'
  }

  // ==========================
  // REGLAS DTF
  // ==========================

  if (fallback.technique === 'DTF') {
    completed.techniqueCompatibility =
      'La técnica DTF es compatible con diferentes tipos de prendas y diseños a color. Revisar principalmente resolución, tamaño visual, bordes, ubicación y calidad del archivo.'
  }

  // ==========================
  // REGLAS SUBLIMACIÓN
  // ==========================

  if (fallback.technique === 'Sublimación') {
    const baseColor = String(
      fallback.productColor || ''
    ).toLowerCase()

    const isDarkGarment =
      baseColor.includes('negro') ||
      baseColor.includes('oscuro') ||
      baseColor.includes('azul marino') ||
      baseColor.includes('gris oscuro')

    if (isDarkGarment) {
      completed.riskLevel = 'alto'
      completed.isTechniqueRecommended = false

      completed.techniqueCompatibility =
        'La sublimación no es recomendada para prendas base oscuras. Se recomienda utilizar DTF o vinil textil según el diseño.'

      completed.recommendation =
        'Cambiar la técnica antes de producción.'

      completed.clientMessage =
        `La prenda ${
          fallback.product || ''
        } de color ${
          fallback.productColor || ''
        } no es recomendable para sublimación. Se recomienda confirmar una técnica alternativa antes de producción.`

      completed.productionNote =
        'No proceder con sublimación sobre una prenda base oscura.'

      completed.warnings = [
        ...new Set([
          ...completed.warnings,
          'La sublimación no es recomendable sobre prendas base oscuras.'
        ])
      ]
    }
  }

  // ==========================
  // REGLAS BORDADO
  // ==========================

  if (fallback.technique === 'Bordado') {
    completed.techniqueCompatibility =
      'El bordado es adecuado para logotipos, nombres, textos y diseños con detalles moderados. Debe evaluarse la complejidad, tamaño y cantidad de colores del diseño.'

    const aiText =
      JSON.stringify(completed).toLowerCase()

    const hasComplexEmbroidery =
      aiText.includes('degradado') ||
      aiText.includes('fotografía') ||
      aiText.includes('sombras') ||
      aiText.includes('muchos detalles') ||
      aiText.includes('contornos finos')

    if (hasComplexEmbroidery) {
      completed.riskLevel = 'alto'
      completed.isTechniqueRecommended = false

      completed.recommendation =
        'Simplificar el diseño para bordado o utilizar DTF para conservar mayor detalle.'

      completed.warnings = [
        ...new Set([
          ...completed.warnings,
          'El diseño puede ser demasiado complejo para bordado.'
        ])
      ]
    }
  }

  // ==========================
  // REGLAS VINIL TEXTIL
  // ==========================

  if (fallback.technique === 'Vinil textil') {
    completed.techniqueCompatibility =
      'El vinil textil es adecuado para nombres, números, diseños simples y colores especiales. No es ideal para fotografías, degradados o diseños con demasiados detalles pequeños.'
  }

  return completed
}

export const buildAIPrompt = ({
  garmentSource,
  product,
  productType,
  productColor,
  size,
  technique,
  quantity,
  customizationSide,
  customerGarmentDescription,
  textElements = [],
  imageElements = []
}) => {
  const sourceLabel =
    garmentSource === 'customer'
      ? 'Prenda proporcionada por el cliente'
      : 'Producto del inventario'

  const sizeGuide = {
    XS: 'Recomienda medidas compactas y proporcionadas.',
    S: 'Recomienda medidas compactas por elemento.',
    M: 'Recomienda tamaños medios por elemento.',
    L: 'Recomienda tamaños amplios pero proporcionados.',
    XL: 'Puede recomendar tamaños mayores si se observan proporcionados.',
    '2XL': 'Puede recomendar tamaños amplios manteniendo proporción.',
    '3XL': 'Puede recomendar tamaños amplios manteniendo proporción.'
  }

  return `
Eres un asistente inteligente especializado en personalización de prendas y uniformes.

Tu función es evaluar si una personalización es adecuada antes de enviarla a producción.

El sistema puede trabajar con:
- prendas del inventario del negocio;
- prendas proporcionadas directamente por el cliente.

No limites el análisis a jerseys ni a uniformes de moto enduro.

Puedes analizar prendas como:
- playeras;
- polos;
- camisas;
- camisas tipo Columbia;
- jerseys;
- sudaderas;
- chaquetas;
- uniformes deportivos;
- pantalones;
- shorts;
- kits;
- y otros tipos de prendas textiles.

IMPORTANTE:

La imagen base puede contener:
- estampados originales;
- costuras;
- bolsillos;
- marcas;
- logos;
- letras;
- gráficos propios de la prenda.

Debes analizar SOLO los elementos agregados durante la personalización:
- textos;
- nombres;
- números;
- logos;
- imágenes;
- diseños adicionales.

No consideres como personalización los elementos que ya pertenecen a la prenda base.

No incluyas el color de la prenda base dentro de productionColors.

productionColors debe contener únicamente los colores visibles de los elementos personalizados.

DATOS DEL PEDIDO

Origen:
${sourceLabel}

Prenda:
${product || 'No especificada'}

Tipo:
${productType || 'No especificado'}

Descripción adicional:
${
  customerGarmentDescription ||
  'Sin descripción adicional'
}

Color de la prenda:
${productColor || 'No especificado'}

Talla:
${size || 'No especificada'}

Cantidad:
${quantity || 'No especificada'}

Técnica seleccionada:
${technique || 'No especificada'}

Área seleccionada:
${customizationSide || 'No especificada'}

TEXTOS AGREGADOS

${
  textElements.length > 0
    ? textElements.join(', ')
    : 'Ninguno'
}

IMÁGENES O LOGOS AGREGADOS

Cantidad:
${imageElements.length}

GUÍA GENERAL DE TAMAÑO

${
  sizeGuide[size] ||
  'Recomienda un tamaño proporcional según la talla y el tipo de prenda.'
}

REGLAS GENERALES

- Evalúa la técnica según la prenda y el diseño.
- Evalúa ubicación y proporción visual.
- Evalúa legibilidad.
- Evalúa resolución y calidad del archivo cuando corresponda.
- Evalúa si la personalización invade costuras, cierres, bolsillos o zonas problemáticas visibles.
- No inventes materiales de la prenda si no fueron proporcionados.
- Si necesitas información que no está disponible, indícalo como advertencia en lugar de inventarla.

REGLAS DTF

- Es apropiado para diseños a color y con detalles.
- Puede utilizarse sobre prendas claras u oscuras.
- Evaluar resolución, bordes, tamaño, ubicación y calidad.
- No rechazar DTF únicamente por el color oscuro de la prenda.

REGLAS BORDADO

- Es adecuado para logos, nombres y diseños relativamente simples.
- Evaluar cantidad de colores.
- Evaluar grosor de líneas.
- Evaluar tamaño.
- Evaluar nivel de detalle.
- Fotografías, degradados, sombras complejas y detalles demasiado pequeños pueden no ser adecuados.
- Si el diseño es demasiado complejo, recomendar simplificarlo o utilizar DTF.

REGLAS SUBLIMACIÓN

- Es adecuada principalmente cuando la prenda y el material permiten sublimación.
- En prendas oscuras, advertir que la sublimación tradicional puede no mostrar correctamente los colores.
- Si la prenda es oscura, recomendar evaluar una técnica alternativa como DTF.
- No asumir composición del tejido si esa información no fue proporcionada.

REGLAS VINIL TEXTIL

- Es adecuado para nombres, números y diseños simples.
- Puede ser útil para colores especiales como dorado, plateado, neón o reflectivo.
- No es ideal para fotografías, degradados o diseños extremadamente detallados.

REGLAS SERIGRAFÍA

- Es adecuada para diseños repetitivos y cantidades mayores.
- Funciona mejor con diseños de colores definidos.
- Evaluar cantidad de colores y complejidad.
- Diseños con degradados, fotografías o demasiados colores pueden requerir otra técnica.

REGLAS DE TAMAÑO

- recommendedSizes debe incluir una recomendación por cada elemento personalizado detectado.
- Si hay varios textos o logos, no des una única medida general.
- Usa centímetros.
- Ajusta las medidas según talla, ubicación y tipo de prenda.
- Evita recomendar tamaños absurdamente grandes.
- Mantén proporción visual.

REGLAS DE COLORES

- productionColors debe incluir SOLO colores de la personalización.
- No incluir el color base de la prenda.
- Si el texto es blanco sobre prenda negra, devolver ["Blanco"].
- Si un logo tiene varios colores, incluir los principales.

MENSAJE PARA EL CLIENTE

Debe ser claro y formal.

Debe mencionar cuando corresponda:
- prenda;
- talla;
- técnica;
- ubicación;
- tamaños recomendados;
- posibles riesgos;
- solicitud de confirmación antes de producción.

NOTA PARA PRODUCCIÓN

Debe contener instrucciones útiles para producción.

No debe hablar únicamente de moto enduro.

Debe adaptarse al tipo de prenda evaluada.

RESPUESTA

Responde únicamente JSON válido.

No escribas markdown.

No escribas bloques de código.

No escribas texto antes ni después del JSON.

No escribas etiquetas <think>.

Usa exactamente esta estructura:

{
  "riskLevel": "bajo",
  "isTechniqueRecommended": true,
  "techniqueCompatibility": "Explicación técnica",
  "detectedPlacement": "Ubicación detectada",
  "recommendedSizes": [
    {
      "element": "Elemento personalizado",
      "recommendedSize": "Medida aproximada en centímetros",
      "note": "Nota breve"
    }
  ],
  "productionColors": [
    "Color"
  ],
  "visualFit": "Evaluación de proporción visual",
  "customElementsDetected": [
    "Elemento detectado"
  ],
  "recommendation": "Recomendación general",
  "clientMessage": "Mensaje para el cliente",
  "productionNote": "Nota para producción",
  "warnings": [
    "Advertencia"
  ]
}

Valores permitidos para riskLevel:
- "bajo"
- "medio"
- "alto"
`
}