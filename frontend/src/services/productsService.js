import {
  collection,
  addDoc,
  getDocs,
  doc,
  updateDoc
} from 'firebase/firestore'

import { db } from '../firebase/config'

const PRODUCTS_COLLECTION = 'products'

export const getProducts = async () => {
  const snapshot = await getDocs(
    collection(db, PRODUCTS_COLLECTION)
  )

  return snapshot.docs.map((document) => ({
    id: document.id,
    ...document.data()
  }))
}

export const createProduct = async (productData) => {
  const newProduct = {
    ...productData,

    stock: Number(productData.stock) || 0,

    active: true,

    createdAt: new Date().toISOString(),

    updatedAt: new Date().toISOString()
  }

  const documentRef = await addDoc(
    collection(db, PRODUCTS_COLLECTION),
    newProduct
  )

  return {
    id: documentRef.id,
    ...newProduct
  }
}

export const updateProduct = async (
  productId,
  productData
) => {
  const productRef = doc(
    db,
    PRODUCTS_COLLECTION,
    productId
  )

  const updatedProduct = {
    ...productData,

    stock: Number(productData.stock) || 0,

    updatedAt: new Date().toISOString()
  }

  await updateDoc(
    productRef,
    updatedProduct
  )

  return {
    id: productId,
    ...updatedProduct
  }
}

export const changeProductStatus = async (
  productId,
  active
) => {
  const productRef = doc(
    db,
    PRODUCTS_COLLECTION,
    productId
  )

  await updateDoc(productRef, {
    active,
    updatedAt: new Date().toISOString()
  })
}