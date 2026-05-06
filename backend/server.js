import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Groq from 'groq-sdk'

dotenv.config()

const app = express()

app.use(cors({
  origin: ['http://localhost:3000', 'http://localhost:5173'],
  methods: ['GET', 'POST'],
  allowedHeaders: ['Content-Type']
}))

app.use(express.json({ limit: '20mb' }))

if (!process.env.GROQ_API_KEY) {
  console.error('Falta GROQ_API_KEY en el archivo .env')
  process.exit(1)
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

const VALID_PRODUCT_TYPES = ['jersey', 'pantalon', 'kit']
const VALID_TECHNIQUES = ['DTF', 'Bordado', 'Sublimación', 'Vinil textil']
const VALID_SIDES = ['frente', 'espalda', 'ambos']

const SIZE_GUIDE = {
  S: 'Para talla S, recomienda medidas compactas por elemento. Evita diseños demasiado grandes.',
  M: 'Para talla M, recomienda medidas medias por elemento.',
  L: 'Para talla L, recomienda medidas amplias pero proporcionadas por elemento.',
  XL: 'Para talla XL, puede recomendarse un tamaño mayor por elemento si se ve proporcionado.'
}

const normalizeText = (value) => {
  if (!value) return ''
  return String(value).trim()
}

const cleanAIText = (text) => {
  return text
    .replace(/```json/g, '')
    .replace(/```/g, '')
    .trim()
}

const validateBasicRules = ({
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

  if (!product) {
    warnings.push('No se recibió el producto seleccionado.')
    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!VALID_PRODUCT_TYPES.includes(productType)) {
    warnings.push('El tipo de producto no es válido.')
    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!size) {
    warnings.push('Debe seleccionar una talla.')
    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!VALID_TECHNIQUES.includes(technique)) {
    warnings.push('La técnica seleccionada no es válida.')
    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!VALID_SIDES.includes(customizationSide)) {
    warnings.push('Debe seleccionar frente, espalda o ambos.')
    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!quantity || Number(quantity) <= 0) {
    warnings.push('La cantidad debe ser mayor a 0.')
    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  return {
    hasBlockingError: riskLevel === 'alto',
    result: {
      riskLevel,
      isTechniqueRecommended,
      techniqueCompatibility: isTechniqueRecommended
        ? 'La técnica puede continuar a revisión visual.'
        : 'La técnica o los datos del pedido necesitan corrección.',
      detectedPlacement: customizationSide || 'zona no seleccionada',
      recommendedSizes: [],
      productionColors: [],
      visualFit: 'Pendiente de revisión.',
      customElementsDetected: [],
      recommendation: isTechniqueRecommended
        ? 'El pedido puede continuar a validación visual con IA.'
        : 'El pedido necesita corrección antes de continuar.',
      clientMessage: isTechniqueRecommended
        ? 'Su pedido será revisado visualmente antes de enviarse a producción.'
        : 'Su pedido necesita ajustes antes de continuar.',
      productionNote: 'Validación inicial para uniformes de moto enduro.',
      warnings
    }
  }
}

const completeAIResult = (result, fallback = {}) => {
  const completed = {
    riskLevel: result?.riskLevel || fallback.riskLevel || 'medio',

    isTechniqueRecommended:
      typeof result?.isTechniqueRecommended === 'boolean'
        ? result.isTechniqueRecommended
        : fallback.isTechniqueRecommended ?? true,

    techniqueCompatibility:
      normalizeText(result?.techniqueCompatibility) ||
      `La técnica ${fallback.technique || 'seleccionada'} debe revisarse según los elementos agregados por el cliente.`,

    detectedPlacement:
      normalizeText(result?.detectedPlacement) ||
      `Diseño agregado en ${fallback.customizationSide || 'la zona seleccionada'}.`,

    recommendedSizes:
      Array.isArray(result?.recommendedSizes) &&
      result.recommendedSizes.length > 0
        ? result.recommendedSizes
        : fallback.customElementsDetected.map((element) => ({
            element,
            recommendedSize:
              fallback.size === 'S'
                ? '18 cm x 5 cm'
                : fallback.size === 'M'
                ? '22 cm x 6 cm'
                : fallback.size === 'L'
                ? '26 cm x 7 cm'
                : '30 cm x 8 cm',
            note: 'Medida aproximada recomendada'
          })),

    productionColors: Array.isArray(result?.productionColors)
      ? result.productionColors
      : [],

    visualFit:
      normalizeText(result?.visualFit) ||
      'La proporción visual debe confirmarse antes de producción.',

    customElementsDetected: Array.isArray(result?.customElementsDetected)
      ? result.customElementsDetected
      : fallback.customElementsDetected || [],

    recommendation:
      normalizeText(result?.recommendation) ||
      'Revisar tamaño, ubicación y técnica antes de aprobar.',

    clientMessage:
      normalizeText(result?.clientMessage) ||
      'Su diseño fue recibido y será revisado antes de producción.',

    productionNote:
      normalizeText(result?.productionNote) ||
      'Validar técnica, tamaño, ubicación, colores y calidad del archivo antes de producir.',

    warnings: Array.isArray(result?.warnings)
      ? result.warnings
      : ['Revisar manualmente la vista previa antes de producción.']
  }

  if (!['bajo', 'medio', 'alto'].includes(completed.riskLevel)) {
    completed.riskLevel = 'medio'
  }

  if (fallback.technique === 'DTF') {
    completed.techniqueCompatibility =
      'La técnica DTF es compatible con prendas oscuras y diseños a color. Revisar principalmente resolución, tamaño visual, bordes, ubicación y calidad del archivo.'

    completed.warnings = completed.warnings.filter((warning) => {
      const text = String(warning).toLowerCase()

      return (
        !text.includes('incompatibilidad con la técnica dtf') &&
        !text.includes('no compatible con dtf') &&
        !text.includes('no es compatible con dtf') &&
        !text.includes('colores que podrían no ser compatibles')
      )
    })
  }

  if (fallback.technique === 'Sublimación') {
    const baseColor = String(fallback.productColor || '').toLowerCase()

    if (
      baseColor.includes('negro') ||
      baseColor.includes('oscuro') ||
      baseColor.includes('azul marino') ||
      baseColor.includes('gris oscuro')
    ) {
      completed.riskLevel = 'alto'
      completed.isTechniqueRecommended = false
      completed.techniqueCompatibility =
        'La sublimación no es recomendada para prendas base oscuras, ya que los colores del diseño pueden no apreciarse correctamente. Se recomienda cambiar a DTF o vinil textil según el diseño.'

      completed.recommendation =
        'No se recomienda continuar con sublimación en esta prenda oscura. Cambiar la técnica a DTF o vinil textil.'

      completed.clientMessage =
        `Estimado cliente, su pedido de ${fallback.product || 'uniforme'} en talla ${fallback.size || ''} fue revisado. La técnica de sublimación no es recomendable para una prenda base oscura como ${fallback.productColor || 'negro'}, ya que los colores del diseño pueden no apreciarse correctamente. Se recomienda cambiar la técnica a DTF o vinil textil antes de proceder con producción.`

      completed.productionNote =
        'No proceder con sublimación sobre prenda base oscura. Confirmar cambio de técnica con el cliente.'

      completed.warnings = [
        ...new Set([
          ...completed.warnings,
          'La sublimación no es compatible con prendas base oscuras.',
          'Confirmar cambio de técnica antes de producción.'
        ])
      ]
    }
  }

  if (fallback.technique === 'Bordado') {
    const elementCount = fallback.customElementsDetected?.length || 0

    completed.techniqueCompatibility =
      'El bordado puede aplicarse correctamente en textos simples, logos pequeños y diseños con pocos detalles. Sin embargo, el tamaño y cantidad de elementos deben mantenerse proporcionados para evitar pérdida de nitidez.'

    completed.productionNote = completed.productionNote.replace(/aguja/gi, 'hilo')

    completed.warnings = completed.warnings.map((warning) =>
      String(warning).replace(/aguja/gi, 'hilo')
    )

    const sizesText = JSON.stringify(completed.recommendedSizes).toLowerCase()

    const hasLargeElements =
      sizesText.includes('30 cm') ||
      sizesText.includes('28 cm') ||
      sizesText.includes('26 cm')

    if (elementCount > 1 || hasLargeElements) {
      completed.riskLevel =
        completed.riskLevel === 'alto' ? 'alto' : 'medio'

      completed.isTechniqueRecommended = true

      completed.techniqueCompatibility =
        'El bordado puede aplicarse al diseño actual; sin embargo, algunos elementos parecen grandes para mantener buena nitidez y definición.'

      completed.recommendation =
        'Se recomienda reducir ligeramente el tamaño de algunos elementos o considerar DTF si se desea conservar mejor detalle visual.'

      completed.clientMessage =
        `Estimado cliente, su pedido fue revisado con técnica de bordado. El diseño puede realizarse; sin embargo, algunos elementos parecen grandes para bordado y podrían perder nitidez o definición. Se recomienda reducir ligeramente el tamaño o considerar DTF si desea conservar mayor detalle visual antes de proceder con producción.`

      completed.productionNote =
        'Validar tamaño final de cada elemento personalizado antes de bordar. Si el diseño mantiene tamaños grandes, recomendar DTF para conservar mejor definición.'

      completed.warnings = [
        ...new Set([
          ...completed.warnings,
          'El bordado puede perder nitidez en elementos grandes.',
          'Confirmar tamaño final antes de producción.'
        ])
      ]
    }

    const aiText = JSON.stringify(completed).toLowerCase()

    const hasComplexEmbroidery =
      aiText.includes('muchos detalles') ||
      aiText.includes('degradado') ||
      aiText.includes('fotografía') ||
      aiText.includes('sombras') ||
      aiText.includes('muchos colores') ||
      aiText.includes('contornos finos')

    if (hasComplexEmbroidery) {
      completed.riskLevel = 'alto'
      completed.isTechniqueRecommended = false

      completed.techniqueCompatibility =
        'El bordado no es recomendable para imágenes con muchos detalles, degradados, sombras, fotografías o demasiados colores. Para este tipo de diseño se recomienda DTF.'

      completed.recommendation =
        'Simplificar el diseño para bordado o cambiar la técnica a DTF para conservar mejor los detalles.'

      completed.clientMessage =
        'Estimado cliente, su diseño fue revisado para bordado. Debido a que contiene detalles complejos, posibles degradados, sombras o varios colores, no se recomienda producirlo con bordado, ya que podría perder nitidez y definición. Se recomienda simplificar el diseño o cambiar la técnica a DTF antes de proceder con producción.'

      completed.productionNote =
        'No aprobar bordado si el archivo tiene muchos detalles, degradados, sombras, fotografía o demasiados colores. Recomendar DTF o solicitar versión simplificada del diseño.'

      completed.warnings = [
        ...new Set([
          ...completed.warnings,
          'El bordado no es recomendable para diseños con muchos detalles o colores.',
          'Solicitar diseño simplificado o cambiar técnica a DTF.'
        ])
      ]
    }
  }

  if (fallback.technique === 'Vinil textil') {
    completed.techniqueCompatibility =
      'El vinil textil es adecuado para nombres, números, diseños simples y colores especiales como dorado, plateado, neón, fluorescente o reflectivo. No es ideal para diseños con muchos detalles pequeños, fotografías o degradados.'
  }

  return completed
}

app.post('/api/ai/recommendation', async (req, res) => {
  try {
    const {
      product,
      productType,
      productColor,
      size,
      technique,
      quantity,
      customizationSide,
      previewImage,
      elements = []
    } = req.body

    const basicValidation = validateBasicRules({
      product,
      productType,
      size,
      technique,
      quantity,
      customizationSide
    })

    if (basicValidation.hasBlockingError) {
      return res.json({
        source: 'production_rules',
        result: completeAIResult(basicValidation.result, {
          product,
          productType,
          productColor,
          size,
          technique,
          customizationSide
        })
      })
    }

    const hasImage =
      previewImage &&
      typeof previewImage === 'string' &&
      previewImage.startsWith('data:image')

    const textElements = Array.isArray(elements)
      ? elements
          .filter((el) => el.type === 'text')
          .map((el) => el.text)
          .filter(Boolean)
      : []

    const imageElements = Array.isArray(elements)
      ? elements.filter((el) => el.type === 'image')
      : []

    const customElementsDetected = [
      ...textElements.map((text) => `Texto: ${text}`),
      ...imageElements.map((_, index) => `Imagen/logo agregado ${index + 1}`)
    ]

    const prompt = `
Eres un asistente inteligente para una empresa de personalización de uniformes de moto enduro.

IMPORTANTE:
La imagen base del producto puede contener logos, marcas, letras o gráficos propios del jersey.
Debes analizar SOLO los elementos agregados por el cliente:
- textos agregados
- nombres
- números
- logos subidos
- imágenes subidas

No evalúes como personalización los gráficos que ya vienen en la foto base del producto.
No incluyas el color de la prenda base dentro de productionColors.
productionColors debe contener SOLO los colores de los elementos personalizados agregados por el cliente.

Datos del pedido:
Producto: ${product}
Tipo de producto: ${productType}
Color del producto base: ${productColor || 'No especificado'}
Talla seleccionada: ${size || 'No especificada'}
Técnica seleccionada: ${technique}
Cantidad: ${quantity}
Parte seleccionada: ${customizationSide}
Textos agregados por el cliente: ${textElements.length ? textElements.join(', ') : 'Ninguno'}
Cantidad de imágenes/logos agregados por el cliente: ${imageElements.length}
Guía de tamaño por talla: ${SIZE_GUIDE[size] || 'Recomienda un tamaño proporcional según la talla seleccionada.'}

Reglas por técnica:
- DTF sí es compatible con prendas oscuras y diseños a color.
- En DTF revisa resolución, bordes, tamaño visual, ubicación y calidad del archivo.
- No marques incompatibilidad de color en DTF solo porque la prenda sea negra o el diseño tenga colores fuertes.

- Bordado:
  - Puede realizarse si el elemento es simple, pequeño o mediano y con pocos detalles.
  - No rechaces bordado automáticamente si el diseño es simple y no es demasiado grande.
  - No es recomendable para varios elementos grandes en la misma prenda.
  - No es recomendable para diseños que ocupen mucha área del jersey.
  - Si hay varios elementos personalizados grandes, marca riesgo medio o alto.
  - Si el diseño puede perder nitidez o definición, indícalo.
  - No menciones aguja como factor principal.
  - Enfócate en hilo, tamaño del bordado, simplicidad, detalle y complejidad.
  - Si el cliente sube una imagen/logo con muchos detalles pequeños, degradados, sombras, fotografías, contornos muy finos o demasiados colores, marca riesgo medio o alto.
  - Si el logo tiene muchos colores, recomienda simplificar el diseño o cambiar a DTF.
  - Para bordado se recomiendan diseños simples, pocos colores y formas claras.
  - Si el diseño tiene degradados o apariencia fotográfica, indica que no es recomendable para bordado.
  - Si el diseño requiere muchos colores de hilo, advertir que puede aumentar complejidad y pérdida de definición.

- Sublimación:
  - No se recomienda sobre prendas base oscuras, especialmente negro.
  - Si el producto base es negro u oscuro, marca isTechniqueRecommended como false.
  - Si el producto base es negro u oscuro, riskLevel debe ser "alto".
  - Recomienda cambiar a DTF o Vinil textil según el diseño.
  - Explica que los colores pueden no verse correctamente sobre base oscura.

- Vinil textil:
  - Recomendado para nombres, números, diseños simples y colores especiales.
  - Si el diseño contiene colores dorado, plateado, neón, fluorescente, reflectivo o brillantes, recomienda Vinil textil.
  - No es ideal para diseños con muchos detalles pequeños, fotografías o degradados.
  - Evalúa cortes complicados, tamaño, simplicidad y ubicación.

Reglas de tamaño:
- recommendedSizes debe incluir una recomendación separada para cada elemento personalizado detectado.
- No des una sola medida general para todo el diseño si hay varios elementos.
- Si existe texto personalizado, agrega un objeto para cada texto.
- Si existe un número personalizado, agrega un objeto para el número.
- Si existe un logo o imagen personalizada, agrega un objeto para cada logo.
- Usa el nombre o descripción real del elemento detectado.
- No uses ejemplos fijos como KBRA, Honda u otros si no existen en el pedido actual.
- Ajusta cada medida según la talla seleccionada y la ubicación.
- Para talla S, evita elementos demasiado grandes.
- Para talla M, recomienda tamaños medios.
- Para talla L, recomienda tamaños amplios pero proporcionados.
- Para talla XL, puede recomendarse mayor tamaño si se ve proporcionado.
- El tamaño debe darse en centímetros.

Reglas de colores:
- productionColors debe incluir SOLO colores de los elementos personalizados.
- No incluyas el color de la prenda base.
- Si el jersey es negro y el logo agregado es rojo, responde ["Rojo"], no ["Rojo", "Negro"].
- Si hay texto agregado, incluye el color visible del texto.
- Si hay logo agregado, incluye colores visibles del logo agregado.

El mensaje para cliente debe ser formal e incluir:
producto, talla, técnica, ubicación, tamaños recomendados por elemento, colores principales de los elementos personalizados y solicitud de confirmación antes de producción.

Responde SOLO JSON válido, sin markdown, sin bloques de código y sin texto extra.

Estructura exacta:

{
  "riskLevel": "bajo",
  "isTechniqueRecommended": true,
  "techniqueCompatibility": "Explica si la técnica seleccionada es adecuada para los elementos agregados por el cliente",
  "detectedPlacement": "Ubicación visible de los elementos agregados por el cliente",
  "recommendedSizes": [
    {
      "element": "Nombre o descripción del elemento personalizado detectado",
      "recommendedSize": "Tamaño recomendado aproximado en centímetros, por ejemplo 20 cm x 5 cm",
      "note": "Nota breve para este elemento"
    }
  ],
  "productionColors": ["Rojo"],
  "visualFit": "Explica si los elementos agregados se ven proporcionados o si deben ajustarse",
  "customElementsDetected": ["Texto detectado", "Logo o imagen agregada"],
  "recommendation": "Recomendación general",
  "clientMessage": "Mensaje formal para el cliente solicitando validación del pedido",
  "productionNote": "Nota clara para producción",
  "warnings": ["advertencia 1", "advertencia 2"]
}

Valores permitidos:
riskLevel: "bajo", "medio", "alto"
productionColors debe ser un arreglo de colores.
customElementsDetected debe listar solo elementos agregados por el cliente.
recommendedSizes debe ser un arreglo.
`

    const content = [
      {
        type: 'text',
        text: prompt
      }
    ]

    if (hasImage) {
      content.push({
        type: 'image_url',
        image_url: {
          url: previewImage
        }
      })
    }

    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content
        }
      ],
      model: hasImage
        ? 'meta-llama/llama-4-scout-17b-16e-instruct'
        : 'llama-3.3-70b-versatile',
      temperature: 0.1
    })

    let aiText = completion.choices[0]?.message?.content

    if (!aiText) {
      throw new Error('Groq no devolvió contenido')
    }

    aiText = cleanAIText(aiText)

    let parsedResult

    try {
      parsedResult = JSON.parse(aiText)
    } catch {
      parsedResult = {
        riskLevel: 'medio',
        isTechniqueRecommended: false,
        recommendation: aiText || 'No se pudo generar una recomendación estructurada.',
        clientMessage: 'Se recomienda revisar el pedido antes de aprobarlo.',
        productionNote: 'Validar diseño, técnica, ubicación visual y calidad antes de producir.',
        warnings: ['La IA no devolvió un JSON válido.']
      }
    }

    const completedResult = completeAIResult(parsedResult, {
      product,
      productType,
      productColor,
      size,
      technique,
      customizationSide,
      customElementsDetected
    })

    res.json({
      source: hasImage ? 'ai_visual_analysis' : 'ai_text_analysis',
      previousValidation: basicValidation.result,
      result: completedResult
    })
  } catch (error) {
    console.error('Error Groq:', error)

    res.status(500).json({
      error: 'Error con Groq',
      message: error.message
    })
  }
})

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
})