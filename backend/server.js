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
    origin: [
      'http://localhost:3000',
      'http://localhost:5173'
    ],
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

const AI_MODEL = 'qwen/qwen3.8-27b'

/* =========================================================
   UTILIDADES
========================================================= */

const cleanAIText = (text) => {
  if (typeof text !== 'string') return ''

  let cleaned = text
    .replace(/<think>[\s\S]*?<\/think>/gi, '')
    .trim()

  // Eliminar un bloque de razonamiento sin cierre.
  if (/^<think>/i.test(cleaned)) {
    const jsonStart = cleaned.indexOf('{')

    cleaned = jsonStart >= 0
      ? cleaned.slice(jsonStart)
      : ''
  }

  cleaned = cleaned
    .replace(/^```(?:json)?\s*/i, '')
    .replace(/\s*```$/i, '')
    .trim()

  const firstBrace = cleaned.indexOf('{')
  const lastBrace = cleaned.lastIndexOf('}')

  if (firstBrace !== -1 && lastBrace > firstBrace) {
    cleaned = cleaned.slice(firstBrace, lastBrace + 1)
  }

  return cleaned
}

/* =========================================================
   ENDPOINT IA
========================================================= */

app.post('/api/ai/recommendation', async (req, res) => {
  try {
    if (
      !req.body ||
      typeof req.body !== 'object' ||
      Array.isArray(req.body)
    ) {
      return res.status(400).json({
        error: 'Solicitud inválida',
        message: 'Debes enviar los datos del pedido en formato JSON.'
      })
    }

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

    const basicValidation = validateBasicRules({
      garmentSource,
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
       VALIDAR IMAGEN DE VISTA PREVIA
    ===================================================== */

    const hasImage =
      typeof previewImage === 'string' &&
      previewImage.trim().length > 0

    if (
      previewImage != null &&
      typeof previewImage !== 'string'
    ) {
      return res.status(400).json({
        error: 'Imagen inválida',
        message: 'La vista previa debe enviarse como una cadena base64.'
      })
    }

    if (
      hasImage &&
      !/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/=\s]+$/i.test(
        previewImage
      )
    ) {
      return res.status(400).json({
        error: 'Formato de imagen inválido',
        message:
          'Envía la vista previa en formato PNG, JPEG o WebP codificado en base64.'
      })
    }

    /* =====================================================
       ELEMENTOS AGREGADOS POR EL CLIENTE
    ===================================================== */

    const safeElements = Array.isArray(elements)
      ? elements.filter(
          (element) =>
            element &&
            typeof element === 'object'
        )
      : []

    const textElements = safeElements
      .filter(
        (element) =>
          element.type === 'text' &&
          typeof element.text === 'string'
      )
      .map((element) => element.text.trim())
      .filter(Boolean)

    const imageElements = safeElements.filter(
      (element) => element.type === 'image'
    )

    const customElementsDetected = [
      ...textElements.map((text) => `Texto: ${text}`),

      ...imageElements.map(
        (_, index) => `Imagen/logo agregado ${index + 1}`
      )
    ]

    /* =====================================================
       CONSTRUIR PROMPT
    ===================================================== */

    const basePrompt = buildAIPrompt({
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

    if (
      typeof basePrompt !== 'string' ||
      !basePrompt.trim()
    ) {
      throw new Error(
        'No se pudo construir el prompt del asistente.'
      )
    }

    const imageInstruction = hasImage
      ? (
          'Analiza la imagen adjunta junto con los datos del pedido. ' +
          'No inventes detalles que no sean visibles. ' +
          'Si algo no puede determinarse a partir de la imagen, ' +
          'indica que requiere revisión.'
        )
      : (
          'No se adjuntó ninguna imagen. ' +
          'Evalúa únicamente los datos y textos del pedido. ' +
          'No afirmes haber inspeccionado visualmente el diseño.'
        )

    const prompt = [
      basePrompt,
      imageInstruction,
      'Devuelve únicamente un objeto JSON válido y compacto con los campos solicitados. Usa frases breves, evita repeticiones y limita las advertencias a 3. Mantén la respuesta por debajo de 500 tokens.'
    ].join('\n\n')

    /* =====================================================
       PREPARAR TEXTO E IMAGEN
    ===================================================== */

    const messageContent = hasImage
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

    console.log('Solicitud a Groq:', {
      model: AI_MODEL,
      hasImage,
      contentType: Array.isArray(messageContent)
        ? 'array'
        : 'string'
    })

    const completion = await groq.chat.completions.create({
      model: AI_MODEL,

      messages: [
        {
          role: 'user',
          content: messageContent
        }
      ],

      temperature: 0.2,
      max_completion_tokens: 700,

      response_format: {
        type: 'json_object'
      }
    })

    /* =====================================================
       LEER Y VALIDAR RESPUESTA
    ===================================================== */

    const choice = completion.choices?.[0]
    const rawContent = choice?.message?.content

    if (choice?.finish_reason === 'length') {
      return res.status(502).json({
        error: 'Respuesta incompleta',
        message:
          'La respuesta del asistente alcanzó el límite de generación. Intenta nuevamente.'
      })
    }

    if (
      typeof rawContent !== 'string' ||
      !rawContent.trim()
    ) {
      return res.status(502).json({
        error: 'Respuesta vacía',
        message: 'Groq no devolvió contenido para este pedido.'
      })
    }

    const aiText = cleanAIText(rawContent)

    let parsedResult

    try {
      parsedResult = JSON.parse(aiText)

      if (
        !parsedResult ||
        typeof parsedResult !== 'object' ||
        Array.isArray(parsedResult)
      ) {
        throw new Error('Se esperaba un objeto JSON.')
      }
    } catch {
      console.error(
        'La respuesta de Groq no contiene un objeto JSON válido.'
      )

      return res.status(502).json({
        error: 'Respuesta de IA inválida',
        message:
          'El asistente no devolvió una recomendación válida. Intenta nuevamente; el pedido no debe considerarse validado por esta respuesta.'
      })
    }

    /* =====================================================
       COMPLETAR CAMPOS
    ===================================================== */

    const completedResult = completeAIResult(
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

    return res.json({
      source: hasImage
        ? 'ai_visual_analysis'
        : 'ai_text_analysis',

      previousValidation: basicValidation.result,
      result: completedResult
    })
  } catch (error) {
    // No imprimir imágenes, datos del pedido ni credenciales.
    console.error('Error en el asistente:', {
      status: error?.status,
      message: error?.error?.message ?? error?.message,
      retryAfter: error?.headers?.get?.('retry-after')
    })

    const upstreamStatus = Number(error?.status)

    let status = 500
    let message =
      'No se pudo completar el análisis del pedido.'

    if (upstreamStatus === 400) {
      status = 502
      message =
        'Groq rechazó el formato de la solicitud. Revisa el modelo y el contenido enviado.'
    } else if (
      upstreamStatus === 401 ||
      upstreamStatus === 403
    ) {
      status = 502
      message =
        'No se pudo acceder al servicio de IA. Revisa la API key y los permisos del modelo en el backend.'
    } else if (upstreamStatus === 404) {
      status = 502
      message =
        'El modelo configurado no está disponible. Revisa su identificador y disponibilidad en Groq.'
    } else if (upstreamStatus === 413) {
      status = 413
      message =
        'La imagen es demasiado grande. Reduce su tamaño e intenta nuevamente.'
    } else if (upstreamStatus === 429) {
      status = 429
      message =
        'Se alcanzó un límite de uso de Groq. Revisa la cuota o espera antes de intentar nuevamente.'
    } else if (upstreamStatus >= 500) {
      status = 502
      message =
        'El servicio de IA presentó un error temporal. Intenta nuevamente.'
    }

    return res.status(status).json({
      error: 'Error con el asistente',
      message
    })
  }
})

/* =========================================================
   ERRORES DEL CUERPO DE LA SOLICITUD
========================================================= */

app.use((error, req, res, next) => {
  if (res.headersSent) {
    return next(error)
  }

  if (error.type === 'entity.too.large') {
    return res.status(413).json({
      error: 'Solicitud demasiado grande',
      message:
        'Los datos enviados superan el límite de 20 MB. Reduce el tamaño de la imagen.'
    })
  }

  if (error.type === 'entity.parse.failed') {
    return res.status(400).json({
      error: 'JSON inválido',
      message:
        'El cuerpo de la solicitud no tiene un formato JSON válido.'
    })
  }

  console.error('Error del servidor:', {
    name: error?.name,
    type: error?.type
  })

  return res.status(500).json({
    error: 'Error interno',
    message: 'No se pudo procesar la solicitud.'
  })
})

/* =========================================================
   INICIAR SERVIDOR
========================================================= */

const PORT = process.env.PORT || 3001

app.listen(PORT, () => {
  console.log(`Servidor corriendo en puerto ${PORT}`)
  console.log(`Modelo del asistente: ${AI_MODEL}`)
})