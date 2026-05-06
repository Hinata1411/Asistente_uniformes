import express from 'express'
import cors from 'cors'
import dotenv from 'dotenv'
import OpenAI from 'openai'

dotenv.config()

const app = express()
app.use(cors())
app.use(express.json())

const openai = new OpenAI({
  apiKey: process.env.OPENAI_API_KEY
})

// Ruta IA
app.post('/api/ai/recommendation', async (req, res) => {
  try {
    const { product, technique, quantity } = req.body

    const prompt = `
Eres un experto en personalización de uniformes.

Datos del pedido:
Prenda: ${product}
Técnica: ${technique}
Cantidad: ${quantity}

Responde con:
1. Recomendación de técnica
2. Observación de calidad
3. Sugerencia para el cliente
4. Nota para producción
    `

    const response = await openai.responses.create({
      model: "gpt-4.1-mini",
      input: prompt
    })

    res.json({
      result: response.output[0].content[0].text
    })

  } catch (error) {
    console.error(error)
    res.status(500).json({ error: 'Error con IA' })
  }
})

const PORT = 3001

app.listen(PORT, () => {
  console.log(`Servidor corriendo en http://localhost:${PORT}`)
})