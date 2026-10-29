import { useEffect, useState } from 'react'
import { collection, getDocs, onSnapshot } from 'firebase/firestore'

import { db } from '../../firebase/config'

const normalizeKey = (value) =>
  String(value || '')
    .trim()
    .toLowerCase()

const findField = (data, expectedKey) => {
  const normalizedExpected = normalizeKey(expectedKey)

  const matchingKey = Object.keys(data).find(
    (key) => normalizeKey(key) === normalizedExpected,
  )

  return matchingKey ? data[matchingKey] : undefined
}

const normalizeProduct = (document) => {
  const data = document.data()

  const rawSizes = findField(data, 'sizes')

  const rawTechniques = findField(data, 'allowedTechniques')

  const rawSides = findField(data, 'availableSides')

  const rawFrontImage = findField(data, 'frontImage')

  const rawBackImage = findField(data, 'backImage')

  const normalizedProduct = {
    id: document.id,
    category: data.category || 'prenda',

    name: data.name || 'Producto sin nombre',

    type: data.type || '',

    color: data.color || '',

    active: data.active ?? true,

    basePrice: Number(data.basePrice || 0),

    price: Number(data.price ?? data.basePrice ?? 0),

    stock: Number(data.stock || 0),

    size: data.size || (Array.isArray(rawSizes) ? rawSizes[0] || '' : ''),

    legacyMultiSize:
      !data.size && Array.isArray(rawSizes) && rawSizes.length > 1,

    sizes: data.size
      ? [data.size]
      : Array.isArray(rawSizes)
        ? rawSizes.slice(0, 1)
        : [],

    allowedTechniques: Array.isArray(rawTechniques) ? [...rawTechniques] : [],

    availableSides: Array.isArray(rawSides) ? [...rawSides] : [],

    frontImage: rawFrontImage || '',

    backImage: rawBackImage || '',

    images: {
      ...data.images,
      frente: data.images?.frente || rawFrontImage || '',

      espalda: data.images?.espalda || rawBackImage || '',
    },

    createdAt: data.createdAt || '',
  }

  return normalizedProduct
}

function useInventoryProducts() {
  const [inventoryProducts, setInventoryProducts] = useState([])

  const [loadingProducts, setLoadingProducts] = useState(true)

  const [productsError, setProductsError] = useState(null)

  const loadProducts = async () => {
    try {
      setLoadingProducts(true)
      setProductsError(null)

      const snapshot = await getDocs(collection(db, 'products'))

      const productsData = snapshot.docs
        .map(normalizeProduct)
        .filter((product) => product.active !== false)

      setInventoryProducts(productsData)
    } catch (error) {
      console.error('Error cargando inventario:', error)

      setProductsError(error)
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(
    () =>
      onSnapshot(
        collection(db, 'products'),
        (snapshot) => {
          setInventoryProducts(
            snapshot.docs
              .map(normalizeProduct)
              .filter((product) => product.active !== false),
          )
          setProductsError(null)
          setLoadingProducts(false)
        },
        (error) => {
          setProductsError(error)
          setLoadingProducts(false)
        },
      ),
    [],
  )

  return {
    inventoryProducts,
    setInventoryProducts,
    loadingProducts,
    productsError,
    reloadProducts: loadProducts,
  }
}

export default useInventoryProducts
