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
Eres un experto en personalización de uniformes.

Datos:
- Prenda: ${product}
- Técnica: ${technique}
- Cantidad: ${quantity}

Responde:
1. Recomendación de técnica
2. Observación de calidad
3. Sugerencia para el cliente
4. Nota para producción
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