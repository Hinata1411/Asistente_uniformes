import InventoryTypeEditor, { useInventoryTypes } from '../components/InventoryTypes'
import { useEffect, useState } from 'react'
import {
  Link,
  useNavigate
} from 'react-router-dom'
import {
  collection,
  getDocs,
  doc,
  updateDoc,
  deleteDoc,
  query,
  where
} from 'firebase/firestore'

import { db } from '../firebase/config'
import { notify } from '../services/toastStore'
import { askConfirm } from '../services/dialogStore'
import '../styles/ProductsPage.css'

function ProductsPage() {
  const navigate = useNavigate()
  const [products, setProducts] = useState([])
  const [loading, setLoading] = useState(true)
  const [loadError, setLoadError] = useState(false)
  const [category, setCategory] = useState('')
  const [search, setSearch] = useState('')
  const [editingTypes, setEditingTypes] = useState(false)
  const { types: garmentTypes } = useInventoryTypes('prenda')
  const { types: productTypes } = useInventoryTypes('producto')
  const normalizeName = (value) =>
    value.toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').trim()
  const searchName = normalizeName(search)
  const matchingProducts = searchName
    ? products.filter((product) => normalizeName(product.name || '').includes(searchName))
    : products
  const visibleProducts = category
    ? matchingProducts.filter((product) => (product.category || 'prenda') === category)
    : matchingProducts

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
          'Error cargando inventario:',
          error
        )
        setLoadError(true)
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
      notify('El stock no puede ser negativo', 'warning')
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

      notify(
        'No se pudo actualizar el stock',
        'error'
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

      notify(
        'No se pudo actualizar el estado del producto',
        'error'
      )
    }
  }

  const handleDeleteProduct = async (product) => {
    const confirmed = await askConfirm(
      `¿Deseas eliminar definitivamente "${product.name}"?`,
      { confirmLabel: 'Eliminar definitivamente', danger: true }
    )

    if (!confirmed) {
      return
    }

    try {
      const ordersQuery = query(
        collection(db, 'orders'),
        where('productId', '==', product.id)
      )

      const ordersSnapshot = await getDocs(
        ordersQuery
      )

      if (!ordersSnapshot.empty) {
        notify(
          'Este producto ya está asociado a uno o más pedidos. No puede eliminarse definitivamente; puedes desactivarlo.',
          'warning'
        )

        return
      }

      await deleteDoc(
        doc(db, 'products', product.id)
      )

      setProducts((prev) =>
        prev.filter(
          (item) =>
            item.id !== product.id
        )
      )

      notify(
        'Producto eliminado definitivamente',
        'success'
      )
    } catch (error) {
      console.error(
        'Error eliminando producto:',
        error
      )

      notify(
        'No se pudo eliminar el producto',
        'error'
      )
    }
  }

  return (
    <div className="products-page">

      <div className="products-header">
        <div>
          <h2 className="page-title">
            Inventario
          </h2>

          <p className="page-subtitle">
            Consulta los artículos disponibles y sus existencias.
          </p>
        </div>

        <div className="d-flex flex-wrap gap-2">
          <button type="button" className="btn btn-outline-secondary" aria-expanded={editingTypes}
            onClick={() => setEditingTypes(value => !value)}>
            Editar tipos
          </button>
          <Link
            to="/productos/nuevo"
            className="btn btn-primary"
          >
            + Nuevo artículo
          </Link>
        </div>
      </div>

      {editingTypes && <InventoryTypeEditor onClose={() => setEditingTypes(false)} />}

      <label className="d-block mb-3">
        <span className="visually-hidden">Buscar por nombre de artículo</span>
        <input
          type="search"
          className="form-control"
          placeholder="Buscar por nombre de artículo…"
          value={search}
          onChange={(event) => setSearch(event.target.value)}
        />
      </label>

      <div className="d-flex flex-wrap gap-2 mb-3" role="group" aria-label="Filtrar inventario por categoría">
        {[
          ['', 'Todos'],
          ['prenda', 'Prendas'],
          ['producto', 'Productos']
        ].map(([value, label]) => (
          <button
            key={value}
            type="button"
            className={`btn ${category === value ? 'btn-primary' : 'btn-outline-secondary'}`}
            aria-pressed={category === value}
            onClick={() => setCategory(value)}
          >
            {label}
          </button>
        ))}
      </div>

      {loadError && (
        <p role="alert" className="alert alert-danger">No se pudo cargar el inventario.</p>
      )}

      {loading && (
        <div className="text-muted mb-3">
          Cargando inventario...
        </div>
      )}

      <div className="products-grid">
        {visibleProducts.map((product) => (
          <article
            key={product.id}
            className="product-card"
          >
            <div className="product-image-wrapper">
              <img
                src={product.images?.frente || product.images?.espalda ||
                  product.images?.manga_izquierda || product.images?.manga_derecha ||
                  product.frontImage || product.backImage || undefined}
                alt={product.name}
                className="product-image"
              />
            </div>

            <div className="product-content">

              <div className="product-title-row">
                <div>
                  <span className="product-type">
                    {product.category === 'producto' ? 'Producto' : 'Prenda'}
                    {product.type && ` · ${(product.category === 'producto' ? productTypes : garmentTypes).find(type => type.id === product.type)?.label || product.type}`}
                  </span>

                  <h3>
                    {product.name}
                  </h3>
                  <div className="product-price">
                    Q{Number(product.price ?? product.basePrice ?? 0).toFixed(2)}
                  </div>
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

                {product.category !== 'producto' && (
                  <>
                    <div>
                      <span className="product-info-label">
                        Tallas
                      </span>

                      <strong>
                        {product.size || (product.sizes?.length > 0
                          ? product.sizes.join(', ')
                          : 'No definidas')}
                      </strong>
                    </div>

                    <div>
                      <span className="product-info-label">
                        Personalización
                      </span>

                      <strong>
                        {product.availableSides?.length > 0
                          ? product.availableSides
                              .map(side => ({
                                frente: 'Frente',
                                espalda: 'Espalda',
                                ambos: 'Frente y espalda',
                                manga_izquierda: 'Manga izquierda',
                                manga_derecha: 'Manga derecha',
                                mangas: 'Ambas mangas'
                              })[side] || side)
                              .join(', ')
                          : 'No definida'}
                      </strong>
                    </div>

                  </>
                )}

              </div>

              <div className="product-techniques">
                {product.category !== 'producto' && (
                  <span className="product-info-label">Técnicas permitidas</span>
                )}

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
                    Editar
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

                  <button
                    type="button"
                    className="btn btn-outline-danger btn-sm"
                    onClick={() =>
                      handleDeleteProduct(product)
                    }
                  >
                    Eliminar
                  </button>

                </div>
                
                {product.category !== 'producto' && (
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
                )}
              </div>

            </div>
          </article>
        ))}
      </div>

      {!loading && !loadError && visibleProducts.length === 0 && (
        <div className="empty-products">
          {searchName ? 'No hay artículos que coincidan con la búsqueda y la categoría.' : 'No hay artículos en esta vista.'}
        </div>
      )}

    </div>
  )
}

export default ProductsPage
