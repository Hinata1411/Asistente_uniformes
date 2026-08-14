import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Groq from 'groq-sdk'

dotenv.config()

const app = express()

app.use(
  cors({
    origin: ['http://localhost:3000', 'http://localhost:5173'],
    methods: ['GET', 'POST'],
    allowedHeaders: ['Content-Type']
  })
)

app.use(express.json({ limit: '20mb' }))

if (!process.env.GROQ_API_KEY) {
  console.error('Falta GROQ_API_KEY en el archivo .env')
  process.exit(1)
}

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

const VALID_PRODUCT_TYPES = ['jersey', 'pantalon', 'kit']

const VALID_TECHNIQUES = [
  'DTF',
  'Bordado',
  'Sublimación',
  'Vinil textil'
]

const VALID_SIDES = ['frente', 'espalda', 'ambos']

const SIZE_GUIDE = {
  S: 'Para talla S, recomienda medidas compactas por elemento. Evita diseños demasiado grandes.',
  M: 'Para talla M, recomienda medidas medias por elemento.',
  L: 'Para talla L, recomienda medidas amplias pero proporcionadas por elemento.',
  XL: 'Para talla XL, puede recomendarse un tamaño mayor por elemento si se ve proporcionado.'
}

/* =========================================================
   UTILIDADES
========================================================= */

const normalizeText = (value) => {
  if (!value) return ''
  return String(value).trim()
}

const cleanAIText = (text) => {
  if (!text) return ''

  let cleaned = String(text)

  /*
    Algunos modelos pueden responder:

    <think>
      razonamiento...
    </think>

    { JSON }

    Eliminamos completamente ese bloque.
  */
  cleaned = cleaned.replace(
    /<think>[\s\S]*?<\/think>/gi,
    ''
  )

  /*
    En caso de que el modelo abra <think>
    pero no lo cierre correctamente.
  */
  cleaned = cleaned.replace(
    /<think>[\s\S]*?(?=\{)/gi,
    ''
  )

  /*
    Eliminar posibles bloques Markdown.
  */
  cleaned = cleaned
    .replace(/```json/gi, '')
    .replace(/```/g, '')
    .trim()

  /*
    Extraer solamente el objeto JSON.
  */
  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (
    firstBrace !== -1 &&
    lastBrace !== -1 &&
    lastBrace > firstBrace
  ) {
    cleaned = cleaned.slice(
      firstBrace,
      lastBrace + 1
    )
  }

  return cleaned.trim()
}

/* =========================================================
   VALIDACIONES BÁSICAS
========================================================= */

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
    warnings.push(
      'No se recibió el producto seleccionado.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!VALID_PRODUCT_TYPES.includes(productType)) {
    warnings.push(
      'El tipo de producto no es válido.'
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

  if (!VALID_TECHNIQUES.includes(technique)) {
    warnings.push(
      'La técnica seleccionada no es válida.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!VALID_SIDES.includes(customizationSide)) {
    warnings.push(
      'Debe seleccionar frente, espalda o ambos.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  if (!quantity || Number(quantity) <= 0) {
    warnings.push(
      'La cantidad debe ser mayor a 0.'
    )

    riskLevel = 'alto'
    isTechniqueRecommended = false
  }

  return {
    hasBlockingError: riskLevel === 'alto',

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
        'Validación inicial para uniformes de moto enduro.',

      warnings
    }
  }
}

/* =========================================================
   COMPLETAR Y NORMALIZAR RESULTADO DE IA
========================================================= */

const completeAIResult = (
  result,
  fallback = {}
) => {
  const completed = {
    riskLevel:
      result?.riskLevel ||
      fallback.riskLevel ||
      'medio',

    isTechniqueRecommended:
      typeof result?.isTechniqueRecommended ===
      'boolean'
        ? result.isTechniqueRecommended
        : fallback.isTechniqueRecommended ?? true,

    techniqueCompatibility:
      normalizeText(
        result?.techniqueCompatibility
      ) ||
      `La técnica ${
        fallback.technique || 'seleccionada'
      } debe revisarse según los elementos agregados por el cliente.`,

    detectedPlacement:
      normalizeText(
        result?.detectedPlacement
      ) ||
      `Diseño agregado en ${
        fallback.customizationSide ||
        'la zona seleccionada'
      }.`,

    recommendedSizes:
      Array.isArray(
        result?.recommendedSizes
      ) &&
      result.recommendedSizes.length > 0
        ? result.recommendedSizes
        : (
            fallback.customElementsDetected ||
            []
          ).map((element) => ({
            element,

            recommendedSize:
              fallback.size === 'S'
                ? '18 cm x 5 cm'
                : fallback.size === 'M'
                ? '22 cm x 6 cm'
                : fallback.size === 'L'
                ? '26 cm x 7 cm'
                : '30 cm x 8 cm',

            note:
              'Medida aproximada recomendada'
          })),

    productionColors:
      Array.isArray(
        result?.productionColors
      )
        ? result.productionColors
        : [],

    visualFit:
      normalizeText(result?.visualFit) ||
      'La proporción visual debe confirmarse antes de producción.',

    customElementsDetected:
      Array.isArray(
        result?.customElementsDetected
      )
        ? result.customElementsDetected
        : fallback.customElementsDetected ||
          [],

    recommendation:
      normalizeText(
        result?.recommendation
      ) ||
      'Revisar tamaño, ubicación y técnica antes de aprobar.',

    clientMessage:
      normalizeText(
        result?.clientMessage
      ) ||
      'Su diseño fue recibido y será revisado antes de producción.',

    productionNote:
      normalizeText(
        result?.productionNote
      ) ||
      'Validar técnica, tamaño, ubicación, colores y calidad del archivo antes de producir.',

    warnings:
      Array.isArray(result?.warnings)
        ? result.warnings
        : [
            'Revisar manualmente la vista previa antes de producción.'
          ]
  }

  /*
    Normalizar nivel de riesgo.
  */
  if (
    !['bajo', 'medio', 'alto'].includes(
      completed.riskLevel
    )
  ) {
    completed.riskLevel = 'medio'
  }

  /* =======================================================
     REGLAS DTF
  ======================================================= */

  if (fallback.technique === 'DTF') {
    completed.techniqueCompatibility =
      'La técnica DTF es compatible con prendas oscuras y diseños a color. Revisar principalmente resolución, tamaño visual, bordes, ubicación y calidad del archivo.'

    completed.warnings =
      completed.warnings.filter(
        (warning) => {
          const text = String(
            warning
          ).toLowerCase()

          return (
            !text.includes(
              'incompatibilidad con la técnica dtf'
            ) &&
            !text.includes(
              'no compatible con dtf'
            ) &&
            !text.includes(
              'no es compatible con dtf'
            ) &&
            !text.includes(
              'colores que podrían no ser compatibles'
            )
          )
        }
      )
  }

  /* =======================================================
     REGLAS SUBLIMACIÓN
  ======================================================= */

  if (
    fallback.technique ===
    'Sublimación'
  ) {
    const baseColor = String(
      fallback.productColor || ''
    ).toLowerCase()

    if (
      baseColor.includes('negro') ||
      baseColor.includes('oscuro') ||
      baseColor.includes(
        'azul marino'
      ) ||
      baseColor.includes(
        'gris oscuro'
      )
    ) {
      completed.riskLevel = 'alto'

      completed.isTechniqueRecommended =
        false

      completed.techniqueCompatibility =
        'La sublimación no es recomendada para prendas base oscuras, ya que los colores del diseño pueden no apreciarse correctamente. Se recomienda cambiar a DTF o vinil textil según el diseño.'

      completed.recommendation =
        'No se recomienda continuar con sublimación en esta prenda oscura. Cambiar la técnica a DTF o vinil textil.'

      completed.clientMessage =
        `Estimado cliente, su pedido de ${
          fallback.product ||
          'uniforme'
        } en talla ${
          fallback.size || ''
        } fue revisado. La técnica de sublimación no es recomendable para una prenda base oscura como ${
          fallback.productColor ||
          'negro'
        }, ya que los colores del diseño pueden no apreciarse correctamente. Se recomienda cambiar la técnica a DTF o vinil textil antes de proceder con producción.`

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

  /* =======================================================
     REGLAS BORDADO
  ======================================================= */

  if (
    fallback.technique ===
    'Bordado'
  ) {
    const elementCount =
      fallback.customElementsDetected
        ?.length || 0

    completed.techniqueCompatibility =
      'El bordado puede aplicarse correctamente en textos simples, logos pequeños y diseños con pocos detalles. Sin embargo, el tamaño y cantidad de elementos deben mantenerse proporcionados para evitar pérdida de nitidez.'

    completed.productionNote =
      completed.productionNote.replace(
        /aguja/gi,
        'hilo'
      )

    completed.warnings =
      completed.warnings.map(
        (warning) =>
          String(warning).replace(
            /aguja/gi,
            'hilo'
          )
      )

    const sizesText = JSON.stringify(
      completed.recommendedSizes
    ).toLowerCase()

    const hasLargeElements =
      sizesText.includes('30 cm') ||
      sizesText.includes('28 cm') ||
      sizesText.includes('26 cm')

    if (
      elementCount > 1 ||
      hasLargeElements
    ) {
      completed.riskLevel =
        completed.riskLevel === 'alto'
          ? 'alto'
          : 'medio'

      completed.isTechniqueRecommended =
        true

      completed.techniqueCompatibility =
        'El bordado puede aplicarse al diseño actual; sin embargo, algunos elementos parecen grandes para mantener buena nitidez y definición.'

      completed.recommendation =
        'Se recomienda reducir ligeramente el tamaño de algunos elementos o considerar DTF si se desea conservar mejor detalle visual.'

      completed.clientMessage =
        'Estimado cliente, su pedido fue revisado con técnica de bordado. El diseño puede realizarse; sin embargo, algunos elementos parecen grandes para bordado y podrían perder nitidez o definición. Se recomienda reducir ligeramente el tamaño o considerar DTF si desea conservar mayor detalle visual antes de proceder con producción.'

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

    const aiText = JSON.stringify(
      completed
    ).toLowerCase()

    const hasComplexEmbroidery =
      aiText.includes(
        'muchos detalles'
      ) ||
      aiText.includes('degradado') ||
      aiText.includes('fotografía') ||
      aiText.includes('sombras') ||
      aiText.includes(
        'muchos colores'
      ) ||
      aiText.includes(
        'contornos finos'
      )

    if (hasComplexEmbroidery) {
      completed.riskLevel = 'alto'

      completed.isTechniqueRecommended =
        false

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

  /* =======================================================
     REGLAS VINIL TEXTIL
  ======================================================= */

  if (
    fallback.technique ===
    'Vinil textil'
  ) {
    completed.techniqueCompatibility =
      'El vinil textil es adecuado para nombres, números, diseños simples y colores especiales como dorado, plateado, neón, fluorescente o reflectivo. No es ideal para diseños con muchos detalles pequeños, fotografías o degradados.'
  }

  return completed
}

/* =========================================================
   ENDPOINT IA
========================================================= */

app.post(
  '/api/ai/recommendation',
  async (req, res) => {
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

      /* =====================================================
         VALIDACIÓN INICIAL
      ===================================================== */

      const basicValidation =
        validateBasicRules({
          product,
          productType,
          size,
          technique,
          quantity,
          customizationSide
        })

      if (
        basicValidation.hasBlockingError
      ) {
        return res.json({
          source: 'production_rules',

          result: completeAIResult(
            basicValidation.result,
            {
              product,
              productType,
              productColor,
              size,
              technique,
              customizationSide,
              customElementsDetected: []
            }
          )
        })
      }

      /* =====================================================
         DETECTAR SI EXISTE PREVIEW
      ===================================================== */

      const hasImage =
        previewImage &&
        typeof previewImage ===
          'string' &&
        previewImage.startsWith(
          'data:image'
        )

      /* =====================================================
         ELEMENTOS AGREGADOS POR CLIENTE
      ===================================================== */

      const textElements =
        Array.isArray(elements)
          ? elements
              .filter(
                (el) =>
                  el.type === 'text'
              )
              .map((el) => el.text)
              .filter(Boolean)
          : []

      const imageElements =
        Array.isArray(elements)
          ? elements.filter(
              (el) =>
                el.type === 'image'
            )
          : []

      const customElementsDetected = [
        ...textElements.map(
          (text) =>
            `Texto: ${text}`
        ),

        ...imageElements.map(
          (_, index) =>
            `Imagen/logo agregado ${
              index + 1
            }`
        )
      ]

      /* =====================================================
         PROMPT
      ===================================================== */

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

Textos agregados por el cliente:
${
  textElements.length
    ? textElements.join(', ')
    : 'Ninguno'
}

Cantidad de imágenes/logos agregados por el cliente:
${imageElements.length}

Guía de tamaño por talla:
${
  SIZE_GUIDE[size] ||
  'Recomienda un tamaño proporcional según la talla seleccionada.'
}

REGLAS POR TÉCNICA:

DTF:
- Es compatible con prendas oscuras y diseños a color.
- Revisar resolución.
- Revisar bordes.
- Revisar tamaño visual.
- Revisar ubicación.
- Revisar calidad del archivo.
- No marcar incompatibilidad únicamente porque la prenda sea negra.

BORDADO:
- Puede utilizarse para elementos simples, pequeños o medianos.
- Es recomendable para pocos detalles y formas claras.
- No rechazar automáticamente diseños simples.
- No es recomendable para varios elementos grandes.
- No es recomendable para fotografías.
- No es recomendable para degradados.
- No es recomendable para sombras complejas.
- No es recomendable para contornos demasiado finos.
- Si existen demasiados colores, recomendar simplificar o utilizar DTF.
- Evaluar tamaño, simplicidad, cantidad de colores y definición.
- Enfocarse en hilo y complejidad del bordado.

SUBLIMACIÓN:
- No se recomienda sobre prendas base oscuras.
- Especialmente no se recomienda sobre negro.
- Si el producto base es oscuro, isTechniqueRecommended debe ser false.
- Si el producto base es oscuro, riskLevel debe ser "alto".
- Recomendar DTF o Vinil textil como alternativa.
- Explicar que los colores pueden no observarse correctamente sobre una base oscura.

VINIL TEXTIL:
- Adecuado para nombres.
- Adecuado para números.
- Adecuado para diseños simples.
- Adecuado para colores especiales.
- Adecuado para dorado.
- Adecuado para plateado.
- Adecuado para neón.
- Adecuado para fluorescente.
- Adecuado para reflectivo.
- No es ideal para fotografías.
- No es ideal para degradados.
- No es ideal para diseños con demasiados detalles pequeños.

REGLAS DE TAMAÑO:

- recommendedSizes debe incluir una recomendación separada para cada elemento personalizado detectado.
- No proporcionar una única medida general si existen varios elementos.
- Si existe texto personalizado, crear un objeto por cada texto.
- Si existe número personalizado, crear un objeto para el número.
- Si existe logo o imagen personalizada, crear un objeto por cada logo.
- Usar el nombre o descripción real del elemento.
- Ajustar cada medida según la talla seleccionada.
- Ajustar según la ubicación.
- Dar las medidas en centímetros.

Para talla S:
- Evitar elementos demasiado grandes.

Para talla M:
- Recomendar tamaños medios.

Para talla L:
- Recomendar tamaños amplios pero proporcionados.

Para talla XL:
- Puede recomendarse un tamaño mayor si se observa proporcionado.

REGLAS DE COLORES:

- productionColors debe incluir SOLO colores de los elementos personalizados.
- No incluir el color de la prenda base.
- Si el jersey es negro y el logo es rojo, responder ["Rojo"].
- Si existe texto agregado, incluir el color visible del texto.
- Si existe logo agregado, incluir los colores visibles del logo.

MENSAJE PARA EL CLIENTE:

Debe ser formal e incluir:
- producto
- talla
- técnica
- ubicación
- tamaños recomendados
- colores principales
- solicitud de confirmación antes de producción

RESPUESTA:

Responde SOLO JSON válido.

No escribas markdown.

No escribas bloques de código.

No escribas explicaciones antes o después del JSON.

No escribas etiquetas <think>.

La estructura exacta debe ser:

{
  "riskLevel": "bajo",
  "isTechniqueRecommended": true,
  "techniqueCompatibility": "Explica si la técnica seleccionada es adecuada para los elementos agregados por el cliente",
  "detectedPlacement": "Ubicación visible de los elementos agregados por el cliente",
  "recommendedSizes": [
    {
      "element": "Nombre o descripción del elemento personalizado detectado",
      "recommendedSize": "Tamaño recomendado aproximado en centímetros",
      "note": "Nota breve para este elemento"
    }
  ],
  "productionColors": ["Rojo"],
  "visualFit": "Explica si los elementos agregados se ven proporcionados o si deben ajustarse",
  "customElementsDetected": [
    "Texto detectado",
    "Logo o imagen agregada"
  ],
  "recommendation": "Recomendación general",
  "clientMessage": "Mensaje formal para el cliente solicitando validación del pedido",
  "productionNote": "Nota clara para producción",
  "warnings": [
    "advertencia 1",
    "advertencia 2"
  ]
}

Valores permitidos:

riskLevel:
- "bajo"
- "medio"
- "alto"

productionColors debe ser un arreglo.

customElementsDetected debe listar solo elementos agregados por el cliente.

recommendedSizes debe ser un arreglo.
`

      /* =====================================================
         PREPARAR CONTENIDO PARA GROQ
      ===================================================== */

      const messageContent =
        hasImage
          ? [
              {
                type: 'text',
                text: prompt
              },

              {
                type: 'image_url',

                image_url: {
                  url: previewImage
                }
              }
            ]
          : prompt

      /* =====================================================
         LLAMADA A GROQ
      ===================================================== */

      const completion =
        await groq.chat.completions.create({
          messages: [
            {
              role: 'user',
              content: messageContent
            }
          ],

          model: hasImage
            ? 'qwen/qwen3.6-27b'
            : 'llama-3.3-70b-versatile',

          temperature: hasImage ? 0.7 : 0.1,

          max_completion_tokens: hasImage
            ? 4096
            : 2048,

          ...(hasImage && {
            reasoning_effort: 'none',
            reasoning_format: 'hidden',
            response_format: {
              type: 'json_object'
            }
          })
        })
      /* =====================================================
         LEER RESPUESTA
      ===================================================== */

      let aiText =
        completion.choices[0]
          ?.message?.content

      if (!aiText) {
        throw new Error(
          'Groq no devolvió contenido'
        )
      }

      /*
        Limpiar posibles:
        - <think>
        - markdown
        - texto extra
      */
      aiText = cleanAIText(aiText)

      console.log('====================================')
      console.log('RESPUESTA LIMPIA DE LA IA:')
      console.log(aiText)
      console.log('====================================')

      let parsedResult

      try {
        parsedResult =
          JSON.parse(aiText)
      } catch (parseError) {
        console.error(
          'JSON inválido devuelto por IA:',
          aiText
        )

        parsedResult = {
          riskLevel: 'medio',

          isTechniqueRecommended:
            false,

          recommendation:
            'No se pudo generar una recomendación estructurada.',

          clientMessage:
            'Se recomienda revisar el pedido antes de aprobarlo.',

          productionNote:
            'Validar diseño, técnica, ubicación visual y calidad antes de producir.',

          warnings: [
            'La IA no devolvió un JSON válido.'
          ]
        }
      }

      /* =====================================================
         COMPLETAR CAMPOS FALTANTES
      ===================================================== */

      const completedResult =
        completeAIResult(
          parsedResult,
          {
            product,
            productType,
            productColor,
            size,
            technique,
            customizationSide,
            customElementsDetected
          }
        )

      /* =====================================================
         RESPUESTA AL FRONTEND
      ===================================================== */

      res.json({
        source: hasImage
          ? 'ai_visual_analysis'
          : 'ai_text_analysis',

        previousValidation:
          basicValidation.result,

        result:
          completedResult
      })
    } catch (error) {
      console.error(
        'Error Groq:',
        error
      )

      res.status(500).json({
        error: 'Error con Groq',
        message: error.message
      })
    }
  }
)

/* =========================================================
   SERVIDOR
========================================================= */

const PORT =
  process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(
    `Servidor corriendo en puerto ${PORT}`
  )
})