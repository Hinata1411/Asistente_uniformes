import { db, storage } from '../firebase/config'
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'
import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'
import GarmentEditor from '../components/GarmentEditor'
import { inventoryProducts } from '../data/inventoryProducts'

function CreateOrderPage() {
  const location = useLocation()

  const [editingOrder, setEditingOrder] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [previewBase64, setPreviewBase64] = useState('')
  const [editorElements, setEditorElements] = useState([])

  const initialForm = {
    customerName: '',
    phone: '',
    productId: '',
    size: '',
    quantity: 1,
    technique: '',
    customizationSide: ''
  }

  const [form, setForm] = useState(initialForm)

  const selectedProduct = inventoryProducts.find(
    (item) => item.id === form.productId
  )

  useEffect(() => {
    if (location.state?.orderToEdit) {
      const order = location.state.orderToEdit

      setForm({
        customerName: order.customerName || '',
        phone: order.phone || '',
        productId: order.productId || '',
        size: order.size || '',
        quantity: order.quantity || 1,
        technique: order.technique || '',
        customizationSide: order.customizationSide || ''
      })

      setEditingOrder(order)
      setAiResult(order.aiValidation || null)
      setEditorElements(order.elements || [])
      window.scrollTo(0, 0)
    }
  }, [location.state])

  const resetForm = () => {
    setForm(initialForm)
    setAiResult(null)
    setPreviewBase64('')
    setEditorElements([])
    setEditingOrder(null)
  }

  const handleSaveOrder = async (order) => {
    try {
      if (
        !form.customerName ||
        !form.phone ||
        !form.productId ||
        !form.size ||
        !form.technique ||
        !form.customizationSide
      ) {
        alert('Completa todos los datos del pedido')
        return
      }

      if (!selectedProduct) {
        alert('Selecciona un producto válido del inventario')
        return
      }

      if (form.quantity <= 0) {
        alert('La cantidad debe ser mayor a 0')
        return
      }

      if (form.quantity > selectedProduct.stock) {
        alert(
          `La cantidad solicitada supera el stock disponible (${selectedProduct.stock})`
        )
        return
      }

      if (!order?.previewImage) {
        alert('Debes generar una vista previa del uniforme')
        return
      }

      if (!aiResult) {
        alert('Debes validar el pedido con IA antes de guardarlo')
        return
      }

      const orderElements = order.elements || editorElements || []

      if (editingOrder) {
        await updateDoc(doc(db, 'orders', editingOrder.id), {
          customerName: form.customerName,
          phone: form.phone,

          productId: selectedProduct.id,
          productName: selectedProduct.name,
          productType: selectedProduct.type,
          productColor: selectedProduct.color,

          size: form.size,
          quantity: form.quantity,
          technique: form.technique,
          customizationSide: form.customizationSide,

          elements: orderElements,

          aiValidation: aiResult,
          aiValidatedAt: new Date().toISOString(),

          updatedAt: new Date().toISOString()
        })

        alert('Pedido actualizado correctamente')
        resetForm()
        return
      }

      const previewPath = `orders/${Date.now()}.png`
      const storageRef = ref(storage, previewPath)

      await uploadString(
        storageRef,
        order.previewImage,
        'data_url'
      )

      const previewImageUrl = await getDownloadURL(storageRef)

      const newOrder = {
        customerName: form.customerName,
        phone: form.phone,

        productId: selectedProduct.id,
        productName: selectedProduct.name,
        productType: selectedProduct.type,
        productColor: selectedProduct.color,

        size: form.size,
        quantity: form.quantity,
        technique: form.technique,
        customizationSide: form.customizationSide,

        elements: orderElements,

        previewImage: previewImageUrl,
        previewPath,

        aiValidation: aiResult,
        aiValidatedAt: new Date().toISOString(),

        status: 'pendiente_aprobacion',

        createdAt: new Date().toISOString()
      }

      await addDoc(collection(db, 'orders'), newOrder)

      alert('Pedido guardado correctamente')
      resetForm()
    } catch (error) {
      console.error('Error guardando pedido:', error)

      alert(
        `Ocurrió un error al guardar el pedido: ${error.message}`
      )
    }
  }

  const handleGenerateAI = async () => {
    try {
      if (
        !selectedProduct ||
        !form.size ||
        !form.technique ||
        !form.quantity ||
        !form.customizationSide
      ) {
        alert(
          'Selecciona producto, talla, técnica, cantidad y lado de personalización'
        )
        return
      }

      if (form.quantity <= 0) {
        alert('La cantidad debe ser mayor a 0')
        return
      }

      if (form.quantity > selectedProduct.stock) {
        alert(
          `Solo hay ${selectedProduct.stock} unidades disponibles`
        )
        return
      }

      setLoadingAI(true)
      setAiResult(null)

      const response = await fetch(
        'http://localhost:3001/api/ai/recommendation',
        {
          method: 'POST',

          headers: {
            'Content-Type': 'application/json'
          },

          body: JSON.stringify({
            product: selectedProduct.name,
            productType: selectedProduct.type,
            productColor: selectedProduct.color,
            size: form.size,
            technique: form.technique,
            quantity: form.quantity,
            customizationSide: form.customizationSide,
            previewImage: previewBase64,
            elements: editorElements
          })
        }
      )

      if (!response.ok) {
        const errorData = await response
          .json()
          .catch(() => null)

        throw new Error(
          errorData?.message ||
            'Error en la respuesta del servidor'
        )
      }

      const data = await response.json()

      let result = data.result

      if (typeof result === 'string') {
        result = JSON.parse(result)
      }

      if (
        result?.text &&
        typeof result.text === 'string'
      ) {
        result = JSON.parse(result.text)
      }

      setAiResult(result)
    } catch (error) {
      console.error('Error con IA:', error)

      alert(`Error con IA: ${error.message}`)
    } finally {
      setLoadingAI(false)
    }
  }

  return (
    <div className="container mt-4">

      <h2>
        {editingOrder
          ? 'Editar Pedido'
          : 'Crear Pedido Personalizado'}
      </h2>

      <div className="card p-3 mb-3">

        <h5>Datos del pedido</h5>

        <div className="row mb-3">

          <div className="col-md-6">

            <label>Nombre del cliente</label>

            <input
              type="text"
              className="form-control"
              value={form.customerName}
              onChange={(e) =>
                setForm({
                  ...form,
                  customerName: e.target.value
                })
              }
            />

          </div>

          <div className="col-md-6">

            <label>Teléfono</label>

            <input
              type="text"
              className="form-control"
              value={form.phone}
              onChange={(e) =>
                setForm({
                  ...form,
                  phone: e.target.value
                })
              }
            />

          </div>

        </div>

        <div className="row">

          <div className="col-md-3">

            <label>
              Producto del inventario
            </label>

            <select
              className="form-control"
              value={form.productId}
              onChange={(e) => {

                setForm({
                  ...form,
                  productId: e.target.value,
                  size: '',
                  technique: '',
                  customizationSide: ''
                })

                setAiResult(null)
                setPreviewBase64('')
                setEditorElements([])
              }}
            >

              <option value="">
                Seleccione
              </option>

              {inventoryProducts.map(
                (product) => (
                  <option
                    key={product.id}
                    value={product.id}
                  >
                    {product.name}
                  </option>
                )
              )}

            </select>

          </div>

          <div className="col-md-3">

            <label>Talla</label>

            <select
              className="form-control"
              value={form.size}
              disabled={!selectedProduct}
              onChange={(e) => {

                setForm({
                  ...form,
                  size: e.target.value
                })

                setAiResult(null)
              }}
            >

              <option value="">
                Seleccione
              </option>

              {selectedProduct?.sizes.map(
                (size) => (
                  <option
                    key={size}
                    value={size}
                  >
                    {size}
                  </option>
                )
              )}

            </select>

          </div>

          <div className="col-md-3">

            <label>Cantidad</label>

            <input
              type="number"
              className="form-control"
              min="1"
              max={selectedProduct?.stock || undefined}
              value={form.quantity}
              onChange={(e) => {

                setForm({
                  ...form,
                  quantity: Number(
                    e.target.value
                  )
                })

                setAiResult(null)
              }}
            />

          </div>

          <div className="col-md-3">

            <label>Técnica</label>

            <select
              className="form-control"
              value={form.technique}
              disabled={!selectedProduct}
              onChange={(e) => {

                setForm({
                  ...form,
                  technique: e.target.value
                })

                setAiResult(null)
              }}
            >

              <option value="">
                Seleccione
              </option>

              {selectedProduct?.allowedTechniques.map(
                (technique) => (
                  <option
                    key={technique}
                    value={technique}
                  >
                    {technique}
                  </option>
                )
              )}

            </select>

          </div>

        </div>

        <div className="row mt-3">

          <div className="col-md-4">

            <label>
              Parte a personalizar
            </label>

            <select
              className="form-control"
              value={form.customizationSide}
              disabled={!selectedProduct}
              onChange={(e) => {

                setForm({
                  ...form,
                  customizationSide:
                    e.target.value
                })

                setAiResult(null)
                setPreviewBase64('')
              }}
            >

              <option value="">
                Seleccione
              </option>

              {selectedProduct?.availableSides.map(
                (side) => (
                  <option
                    key={side}
                    value={side}
                  >

                    {side === 'frente'
                      ? 'Frente'
                      : side === 'espalda'
                      ? 'Espalda'
                      : 'Frente y espalda'}

                  </option>
                )
              )}

            </select>

          </div>

        </div>

        {selectedProduct && (
          <div className="alert alert-light border mt-3">

            <strong>
              Producto seleccionado:
            </strong>{' '}
            {selectedProduct.name}

            <br />

            <strong>Color:</strong>{' '}
            {selectedProduct.color}

            <br />

            <strong>
              Stock disponible:
            </strong>{' '}
            {selectedProduct.stock}

          </div>
        )}

        <button
          className="btn btn-dark mt-3"
          onClick={handleGenerateAI}
          disabled={loadingAI}
        >

          {loadingAI
            ? 'Validando con IA...'
            : 'Validar pedido con IA'}

        </button>

      </div>

      {editingOrder && (
        <div className="alert alert-warning">
          Estás editando datos del pedido.
        </div>
      )}

      {aiResult && (

        <div className="card mt-3 shadow-sm border-0">

          <div className="card-header bg-dark text-white">
            🧠 Validación IA del pedido
          </div>

          <div className="card-body text-start">

            <p>

              <strong>
                Nivel de riesgo:
              </strong>{' '}

              <span
                className={`badge ${
                  aiResult.riskLevel === 'alto'
                    ? 'bg-danger'
                    : aiResult.riskLevel ===
                      'medio'
                    ? 'bg-warning text-dark'
                    : 'bg-success'
                }`}
              >

                {aiResult.riskLevel ||
                  'No definido'}

              </span>

            </p>

            <p>
              <strong>
                Compatibilidad de técnica:
              </strong>{' '}
              {aiResult.techniqueCompatibility ||
                'No especificado'}
            </p>

            <p>
              <strong>
                Ubicación detectada:
              </strong>{' '}
              {aiResult.detectedPlacement ||
                'No detectada'}
            </p>

            <strong>
              Tamaños recomendados por elemento:
            </strong>

            <ul>

              {aiResult.recommendedSizes?.length >
              0 ? (

                aiResult.recommendedSizes.map(
                  (item, index) => (

                    <li key={index}>

                      <strong>
                        {item.element}:
                      </strong>{' '}

                      {item.recommendedSize}

                      {item.note
                        ? ` — ${item.note}`
                        : ''}

                    </li>

                  )
                )

              ) : (

                <li>No definidos</li>

              )}

            </ul>

            <p>

              <strong>
                Colores a utilizar:
              </strong>{' '}

              {aiResult.productionColors?.length >
              0
                ? aiResult.productionColors.join(
                    ', '
                  )
                : 'No especificados'}

            </p>

            <p>

              <strong>
                Proporción visual:
              </strong>{' '}

              {aiResult.visualFit ||
                'No especificada'}

            </p>

            <strong>
              Elementos personalizados detectados:
            </strong>

            <ul>

              {aiResult.customElementsDetected
                ?.length > 0 ? (

                aiResult.customElementsDetected.map(
                  (item, index) => (
                    <li key={index}>
                      {item}
                    </li>
                  )
                )

              ) : (

                <li>
                  Sin elementos detectados
                </li>

              )}

            </ul>

            <p>

              <strong>
                Recomendación general:
              </strong>{' '}

              {aiResult.recommendation ||
                'Sin recomendación'}

            </p>

            <p>

              <strong>
                Mensaje para cliente:
              </strong>{' '}

              {aiResult.clientMessage ||
                'Sin mensaje'}

            </p>

            <p>

              <strong>
                Nota para producción:
              </strong>{' '}

              {aiResult.productionNote ||
                'Sin nota'}

            </p>

            <strong>Advertencias:</strong>

            <ul>

              {aiResult.warnings?.length > 0 ? (

                aiResult.warnings.map(
                  (warning, index) => (
                    <li key={index}>
                      {warning}
                    </li>
                  )
                )

              ) : (

                <li>
                  Sin advertencias
                </li>

              )}

            </ul>

          </div>

        </div>

      )}

      <GarmentEditor
        product={selectedProduct}
        customizationSide={
          form.customizationSide
        }
        onPreviewChange={(base64) =>
          setPreviewBase64(base64)
        }
        onElementsChange={(elements) =>
          setEditorElements(elements)
        }
        onSave={handleSaveOrder}
      />

    </div>
  )
}

export default CreateOrderPage