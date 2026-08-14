import { inventoryProducts } from '../data/inventoryProducts'
import './ProductsPage.css'

function ProductsPage() {
  return (
    <div className="products-page">
      <div className="products-header">
        <div>
          <h2 className="page-title">
            Productos e inventario
          </h2>

          <p className="page-subtitle">
            Consulta las prendas disponibles para personalización,
            sus tallas, técnicas y stock actual.
          </p>
        </div>
      </div>

      <div className="products-grid">
        {inventoryProducts.map((product) => (
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

                  <h3>{product.name}</h3>
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
                    {product.sizes.join(', ')}
                  </strong>
                </div>

                <div>
                  <span className="product-info-label">
                    Personalización
                  </span>

                  <strong>
                    {product.availableSides
                      .map((side) =>
                        side === 'frente'
                          ? 'Frente'
                          : side === 'espalda'
                          ? 'Espalda'
                          : 'Ambos'
                      )
                      .join(', ')}
                  </strong>
                </div>
              </div>

              <div className="product-techniques">
                <span className="product-info-label">
                  Técnicas permitidas
                </span>

                <div className="technique-list">
                  {product.allowedTechniques.map(
                    (technique) => (
                      <span
                        key={technique}
                        className="technique-tag"
                      >
                        {technique}
                      </span>
                    )
                  )}
                </div>
              </div>
            </div>
          </article>
        ))}
      </div>

      {inventoryProducts.length === 0 && (
        <div className="empty-products">
          No hay productos registrados.
        </div>
      )}
    </div>
  )
}

export default ProductsPage