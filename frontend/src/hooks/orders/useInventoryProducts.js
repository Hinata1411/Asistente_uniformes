import { useEffect, useState } from 'react'
import {
  collection,
  getDocs
} from 'firebase/firestore'

import { db } from '../../firebase/config'

function normalizeProduct(document) {
  const data = document.data()

  const sizes = Array.isArray(data.sizes)
    ? [...data.sizes]
    : []

  const allowedTechniques = Array.isArray(
    data.allowedTechniques
  )
    ? [...data.allowedTechniques]
    : []

  const availableSides = Array.isArray(
    data.availableSides
  )
    ? [...data.availableSides]
    : []

  return {
    id: document.id,

    ...data,

    stock: Number(data.stock ?? 0),

    sizes,

    allowedTechniques,

    availableSides,

    images: {
      frente:
        data.images?.frente ||
        data.frontImage ||
        '',

      espalda:
        data.images?.espalda ||
        data.backImage ||
        ''
    }
  }
}

function useInventoryProducts() {
  const [inventoryProducts, setInventoryProducts] =
    useState([])

  const [loadingProducts, setLoadingProducts] =
    useState(true)

  const [productsError, setProductsError] =
    useState(null)

  const loadProducts = async () => {
    try {
      setLoadingProducts(true)
      setProductsError(null)

      const snapshot = await getDocs(
        collection(db, 'products')
      )

      const productsData =
        snapshot.docs.map(normalizeProduct)

      console.log(
        'INVENTARIO CARGADO:',
        productsData
      )

      setInventoryProducts(productsData)
    } catch (error) {
      console.error(
        'Error cargando inventario:',
        error
      )

      setProductsError(error)
    } finally {
      setLoadingProducts(false)
    }
  }

  useEffect(() => {
    loadProducts()
  }, [])

  return {
    inventoryProducts,
    setInventoryProducts,
    loadingProducts,
    productsError,
    reloadProducts: loadProducts
  }
}

export default useInventoryProducts