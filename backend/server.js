import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Groq from 'groq-sdk'
import {
  validateBasicRules,
  completeAIResult,
  buildAIPrompt
} from './services/aiService.js'

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


/* =========================================================
   UTILIDADES
========================================================= */

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
   ENDPOINT IA
========================================================= */

app.post(
  '/api/ai/recommendation',
  async (req, res) => {
    try {
      const {
        garmentSource,
        product,
        productType,
        productColor,
        size,
        technique,
        quantity,
        customizationSide,
        customerGarmentDescription,
        previewImage,
        elements = []
      } = req.body

      /* =====================================================
         VALIDACIÓN INICIAL
      ===================================================== */

      const basicValidation =
        validateBasicRules({
          garmentSource,
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

      const prompt = buildAIPrompt({
        garmentSource,
        product,
        productType,
        productColor,
        size,
        technique,
        quantity,
        customizationSide,
        customerGarmentDescription,
        textElements,
        imageElements
      })

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