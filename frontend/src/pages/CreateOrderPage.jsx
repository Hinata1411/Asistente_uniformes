import { useEffect, useState } from 'react'
import { useLocation } from 'react-router-dom'

import { db, storage } from '../firebase/config'
import { collection, addDoc, doc, updateDoc } from 'firebase/firestore'
import { ref, uploadString, getDownloadURL } from 'firebase/storage'

import GarmentEditor from '../components/GarmentEditor'
import CustomerGarmentForm from '../components/orders/CustomerGarmentForm'
import InventoryGarmentForm from '../components/orders/InventoryGarmentForm'
import GarmentSourceSelector from '../components/orders/GarmentSourceSelector'
import CustomerGarmentPreview from '../components/orders/CustomerGarmentPreview'

import { inventoryProducts } from '../data/inventoryProducts'

import './CreateOrderPage.css'

function CreateOrderPage() {
  const location = useLocation()

  const [editingOrder, setEditingOrder] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [previewBase64, setPreviewBase64] = useState('')
  const [editorElements, setEditorElements] = useState([])
  const [customerGarmentImage, setCustomerGarmentImage] = useState('')

  const initialForm = {
    garmentSource: 'inventory',

    customerName: '',
    phone: '',

    productId: '',

    customerGarmentType: '',
    customerGarmentDescription: '',
    customerGarmentColor: '',

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
        garmentSource: order.garmentSource || 'inventory',

        customerName: order.customerName || '',
        phone: order.phone || '',

        productId: order.productId || '',

        customerGarmentType:
          order.customerGarment?.type || '',

        customerGarmentDescription:
          order.customerGarment?.description || '',

        customerGarmentColor:
          order.customerGarment?.color || '',

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
    setCustomerGarmentImage('')
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
    <div className="create-order-page">

      {/* ENCABEZADO */}
      <div className="order-page-header">
        <div>
          <h2 className="page-title">
            {editingOrder
              ? 'Editar pedido'
              : 'Crear pedido personalizado'}
          </h2>

          <p className="page-subtitle">
            {editingOrder
              ? 'Actualiza la información y personalización del pedido seleccionado.'
              : 'Registra los datos del cliente, personaliza la prenda y valida el diseño antes de guardar.'}
          </p>
        </div>

        {editingOrder && (
          <span className="editing-badge">
            Editando pedido
          </span>
        )}
      </div>

      {/* PASO 1 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number">1</span>

          <div>
            <h3>Información del cliente</h3>
            <p>
              Ingresa los datos de contacto asociados al pedido.
            </p>
          </div>
        </div>

        <div className="row g-3">
          <div className="col-12 col-md-6">
            <label className="form-label">
              Nombre del cliente
            </label>

            <input
              type="text"
              className="form-control"
              placeholder="Ej. Ana López"
              value={form.customerName}
              onChange={(e) =>
                setForm({
                  ...form,
                  customerName: e.target.value
                })
              }
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">
              Teléfono
            </label>

            <input
              type="text"
              className="form-control"
              placeholder="Ej. 5555 5555"
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
      </section>

      {/* PASO 2 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number">2</span>

          <div>
            <h3>Configuración del producto</h3>
            <p>
              Selecciona la prenda y las características del pedido.
            </p>
          </div>
        </div>

        <GarmentSourceSelector
          form={form}
          setForm={setForm}
          setAiResult={setAiResult}
          setPreviewBase64={setPreviewBase64}
          setEditorElements={setEditorElements}
        />

        {form.garmentSource === 'inventory' && (
          <InventoryGarmentForm
            form={form}
            setForm={setForm}
            selectedProduct={selectedProduct}
            inventoryProducts={inventoryProducts}
            setAiResult={setAiResult}
            setPreviewBase64={setPreviewBase64}
            setEditorElements={setEditorElements}
          />
        )}

        {form.garmentSource === 'customer' && (
          <CustomerGarmentForm
            form={form}
            setForm={setForm}
            setAiResult={setAiResult}
          />
        )}
      </section>

      {/* PASO 3 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number">3</span>

          <div>
            <h3>Personalización de la prenda</h3>
            <p>
              Agrega logos, imágenes o texto y ajusta su posición sobre la prenda.
            </p>
          </div>
        </div>

        {form.garmentSource === 'customer' && (
          <CustomerGarmentPreview
            form={form}
            onImageChange={(image) => {
              setCustomerGarmentImage(image)
              setPreviewBase64('')
              setAiResult(null)
            }}
          />
        )}

        <GarmentEditor
          product={selectedProduct}

          customerGarmentImage={customerGarmentImage}

          customerGarment={{
            type: form.customerGarmentType,
            color: form.customerGarmentColor
          }}

          customizationSide={form.customizationSide}

          onPreviewChange={(base64) =>
            setPreviewBase64(base64)
          }

          onElementsChange={(elements) =>
            setEditorElements(elements)
          }

          onSave={handleSaveOrder}
        />
      </section>

      {/* PASO 4 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number ai-number">
            ✦
          </span>

          <div>
            <h3>Validación inteligente</h3>
            <p>
              Analiza la configuración y el diseño antes de registrar el pedido.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="ai-validation-button"
          onClick={handleGenerateAI}
          disabled={loadingAI}
        >
          {loadingAI
            ? 'Analizando personalización...'
            : '✦ Validar personalización con IA'}
        </button>

        {aiResult && (
          <div className="ai-result-card">
            <div className="ai-result-header">
              <div>
                <span className="ai-label">
                  Resultado del asistente
                </span>

                <h4>
                  Validación de la personalización
                </h4>
              </div>

              <span
                className={`risk-badge ${
                  aiResult.riskLevel === 'alto'
                    ? 'risk-high'
                    : aiResult.riskLevel === 'medio'
                    ? 'risk-medium'
                    : 'risk-low'
                }`}
              >
                Riesgo {aiResult.riskLevel || 'no definido'}
              </span>
            </div>

            <div className="ai-result-grid">
              <div className="ai-result-item">
                <span>Compatibilidad técnica</span>
                <strong>
                  {aiResult.techniqueCompatibility || 'No especificado'}
                </strong>
              </div>

              <div className="ai-result-item">
                <span>Ubicación detectada</span>
                <strong>
                  {aiResult.detectedPlacement || 'No detectada'}
                </strong>
              </div>

              <div className="ai-result-item">
                <span>Proporción visual</span>
                <strong>
                  {aiResult.visualFit || 'No especificada'}
                </strong>
              </div>

              <div className="ai-result-item">
                <span>Colores de producción</span>
                <strong>
                  {aiResult.productionColors?.length > 0
                    ? aiResult.productionColors.join(', ')
                    : 'No especificados'}
                </strong>
              </div>
            </div>

            <div className="ai-detail-block">
              <h5>Recomendación general</h5>
              <p>
                {aiResult.recommendation || 'Sin recomendación'}
              </p>
            </div>

            <div className="ai-detail-block">
              <h5>Mensaje para el cliente</h5>
              <p>
                {aiResult.clientMessage || 'Sin mensaje'}
              </p>
            </div>

            <div className="ai-detail-block">
              <h5>Nota para producción</h5>
              <p>
                {aiResult.productionNote || 'Sin nota'}
              </p>
            </div>

            <div className="row g-3">
              <div className="col-12 col-lg-6">
                <div className="ai-list-block">
                  <h5>Tamaños recomendados</h5>

                  <ul>
                    {aiResult.recommendedSizes?.length > 0 ? (
                      aiResult.recommendedSizes.map((item, index) => (
                        <li key={index}>
                          <strong>{item.element}</strong>
                          {' — '}
                          {item.recommendedSize}
                          {item.note ? ` · ${item.note}` : ''}
                        </li>
                      ))
                    ) : (
                      <li>No definidos</li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="ai-list-block">
                  <h5>Advertencias</h5>

                  <ul>
                    {aiResult.warnings?.length > 0 ? (
                      aiResult.warnings.map((warning, index) => (
                        <li key={index}>
                          {warning}
                        </li>
                      ))
                    ) : (
                      <li>Sin advertencias</li>
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>
        )}
      </section>

    </div>
  )
}

export default CreateOrderPage