import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import Groq from 'groq-sdk'

dotenv.config()

const app = express()

app.use(cors())
app.use(express.json())

const groq = new Groq({
  apiKey: process.env.GROQ_API_KEY
})

app.post('/api/ai/recommendation', async (req, res) => {
  try {
    const { product, technique, quantity } = req.body

    const prompt = `
      Eres un asistente inteligente experto en personalización de prendas, uniformes, bordado, DTF y sublimación.

      Analiza el siguiente pedido:

      Prenda: ${product || 'No especificada'}
      Técnica seleccionada: ${technique || 'No especificada'}
      Cantidad: ${quantity || 'No especificada'}

      Debes responder en español, con tono profesional y útil para una tienda de uniformes.

      No inventes precios.
      No apruebes el pedido automáticamente.
      No digas que viste la imagen si no se envió imagen.
      No modifiques el diseño original del cliente.

      Responde exactamente con este formato:

      🧵 Recomendación técnica:
      Explica si la técnica seleccionada es adecuada para la prenda y el tipo de pedido.

      ⚠️ Observaciones de calidad:
      Menciona posibles riesgos como baja resolución, pérdida de detalle, colores difíciles o problemas en bordado.

      👕 Sugerencia para el cliente:
      Da una recomendación clara y sencilla para que el cliente pueda aprobar o corregir el diseño.

      🏭 Nota para producción:
      Indica qué debe revisar el personal antes de producir.

      📌 Resumen final:
      Resume el pedido en 2 líneas.
      `
    const completion = await groq.chat.completions.create({
      messages: [
        {
          role: 'user',
          content: prompt
        }
      ],
      model: 'llama-3.3-70b-versatile'
    })

    res.json({
      result: completion.choices[0]?.message?.content
    })

  } catch (error) {
    console.error('Error Groq:', error)

    res.status(500).json({
      error: 'Error con Groq'
    })
  }
})

app.listen(3001, () => {
  console.log('Servidor corriendo en puerto 3001')
})