import { useEffect, useState } from 'react'
import {
  Link,
  useNavigate
} from 'react-router-dom'
import {
  collection,
  getDocs,
  doc,
  updateDoc
} from 'firebase/firestore'

import { db } from '../firebase/config'
import './ProductsPage.css'

function ProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    const loadProducts = async () => {
      try {
        const snapshot = await getDocs(
          collection(db, 'products')
        )

        const productsData = snapshot.docs.map(
          (document) => ({
            id: document.id,
            ...document.data()
          })
        )

        setProducts(productsData)
      } catch (error) {
        console.error(
          'Error cargando productos:',
          error
        )
      } finally {
        setLoading(false)
      }
    }

    loadProducts()
  }, [])

  const handleStockChange = async (
    productId,
    currentStock,
    change
  ) => {
    const newStock =
      Number(currentStock || 0) + change

    if (newStock < 0) {
      alert('El stock no puede ser negativo')
      return
    }

    try {
      await updateDoc(
        doc(db, 'products', productId),
        {
          stock: newStock
        }
      )

      setProducts((prev) =>
        prev.map((product) =>
          product.id === productId
            ? {
                ...product,
                stock: newStock
              }
            : product
        )
      )
    } catch (error) {
      console.error(
        'Error actualizando stock:',
        error
      )

      alert(
        'No se pudo actualizar el stock'
      )
    }
  }

  const handleToggleActive = async (product) => {
    const newActiveStatus = product.active === false

    try {
      await updateDoc(
        doc(db, 'products', product.id),
        {
          active: newActiveStatus
        }
      )

      setProducts((prev) =>
        prev.map((item) =>
          item.id === product.id
            ? {
                ...item,
                active: newActiveStatus
              }
            : item
        )
      )
    } catch (error) {
      console.error(
        'Error actualizando estado del producto:',
        error
      )

      alert(
        'No se pudo actualizar el estado del producto'
      )
    }
  }
  return (
    <div className="products-page">

      <div className="products-header">
        <div>
          <h2 className="page-title">
            Productos e inventario
          </h2>

          <p className="page-subtitle">
            Consulta las prendas disponibles para
            personalización, sus tallas, técnicas
            y stock actual.
          </p>
        </div>

        <Link
          to="/productos/nuevo"
          className="btn btn-primary"
        >
          + Nuevo producto
        </Link>
      </div>

      {loading && (
        <div className="text-muted mb-3">
          Cargando productos...
        </div>
      )}

      <div className="products-grid">
        {products.map((product) => (
          <article
            key={product.id}
            className="product-card"
          >
            <div className="product-image-wrapper">
              <img
                src={product.images?.frente}
                alt={product.name}
                className="product-image"
              />
            </div>

            <div className="product-content">

              <div className="product-title-row">
                <div>
                  <span className="product-type">
                    {product.type}
                  </span>

                  <h3>
                    {product.name}
                  </h3>
                  <span
                    className={`badge ${
                      product.active === false
                        ? 'bg-secondary'
                        : 'bg-success'
                    }`}
                  >
                    {product.active === false
                      ? 'Inactivo'
                      : 'Activo'}
                  </span>
                </div>

                <span
                  className={`stock-badge ${
                    product.stock > 5
                      ? 'stock-ok'
                      : product.stock > 0
                        ? 'stock-low'
                        : 'stock-empty'
                  }`}
                >
                  {product.stock} disponibles
                </span>
              </div>

              <div className="mt-3">
                <span className="product-info-label">
                  Ajustar stock
                </span>

                <div className="d-flex align-items-center gap-2 mt-2">
                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() =>
                      handleStockChange(
                        product.id,
                        product.stock,
                        -1
                      )
                    }
                    disabled={product.stock <= 0}
                  >
                    −
                  </button>

                  <strong>
                    {product.stock}
                  </strong>

                  <button
                    type="button"
                    className="btn btn-outline-success btn-sm"
                    onClick={() =>
                      handleStockChange(
                        product.id,
                        product.stock,
                        1
                      )
                    }
                  >
                    +
                  </button>
                </div>
              </div>

              <div className="product-info-grid">

                <div>
                  <span className="product-info-label">
                    Color
                  </span>

                  <strong>
                    {product.color}
                  </strong>
                </div>

                <div>
                  <span className="product-info-label">
                    Tallas
                  </span>

                  <strong>
                    {product.sizes?.length > 0
                      ? product.sizes.join(', ')
                      : 'No definidas'}
                  </strong>
                </div>

                <div>
                  <span className="product-info-label">
                    Personalización
                  </span>

                  <strong>
                    {product.availableSides?.length > 0
                      ? product.availableSides
                          .map((side) =>
                            side === 'frente'
                              ? 'Frente'
                              : side === 'espalda'
                                ? 'Espalda'
                                : 'Ambos'
                          )
                          .join(', ')
                      : 'No definida'}
                  </strong>
                </div>

              </div>

              <div className="product-techniques">
                <span className="product-info-label">
                  Técnicas permitidas
                </span>

                <div className="d-flex justify-content-end gap-2 mt-3">
                  <button
                    type="button"
                    className="btn btn-outline-primary btn-sm"
                    onClick={() =>
                      navigate(
                        `/productos/editar/${product.id}`,
                        {
                          state: {
                            productToEdit: product
                          }
                        }
                      )
                    }
                  >
                    Editar producto
                  </button>

                  <button
                    type="button"
                    className={`btn btn-sm ${
                      product.active === false
                        ? 'btn-outline-success'
                        : 'btn-outline-danger'
                    }`}
                    onClick={() =>
                      handleToggleActive(product)
                    }
                  >
                    {product.active === false
                      ? 'Activar'
                      : 'Desactivar'}
                  </button>
                </div>
                
                <div className="technique-list">
                  {product.allowedTechniques?.length > 0 ? (
                    product.allowedTechniques.map(
                      (technique) => (
                        <span
                          key={technique}
                          className="technique-tag"
                        >
                          {technique}
                        </span>
                      )
                    )
                  ) : (
                    <span className="text-muted small">
                      No hay técnicas configuradas.
                    </span>
                  )}
                </div>
              </div>

            </div>
          </article>
        ))}
      </div>

      {!loading && products.length === 0 && (
        <div className="empty-products">
          No hay productos registrados.
        </div>
      )}

    </div>
  )
}

export default ProductsPage