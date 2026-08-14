// src/data/inventoryProducts.js

import jerseyNegraFrente from '../assets/products/jersey-negra-frente.jpg'
import jerseyNegraEspalda from '../assets/products/jersey-negra-espalda.jpg'

export const inventoryProducts = [
  {
    id: 'jersey-negra-enduro',
    name: 'Jersey negra moto enduro',
    type: 'jersey',
    color: 'Negro',
    stock: 10,
    sizes: ['S', 'M', 'L', 'XL'],
    images: {
      frente: jerseyNegraFrente,
      espalda: jerseyNegraEspalda
    },
    availableSides: ['frente', 'espalda', 'ambos'],
    allowedTechniques: ['Sublimación', 'DTF', 'Vinil textil', 'Bordado']
  }
]