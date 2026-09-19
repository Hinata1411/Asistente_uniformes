import {
  collection,
  getDocs
} from 'firebase/firestore'

import { db } from '../firebase/config'

const PRICING_COLLECTION = 'pricingRules'

/*
  Devuelve un objeto:

  {
    DTF: { chico: 15, mediano: 30, grande: 45 },
    Bordado: { chico: 20, mediano: 30, grande: 60 },
    ...
  }

  Cada documento de la colección "pricingRules" tiene como ID
  el nombre exacto de la técnica (debe coincidir con el valor
  usado en el formulario de pedido).
*/
export const getPersonalizationPricing = async () => {
  const snapshot = await getDocs(
    collection(db, PRICING_COLLECTION)
  )

  const pricing = {}

  snapshot.docs.forEach((documentSnap) => {
    pricing[documentSnap.id] = documentSnap.data()
  })

  return pricing
}