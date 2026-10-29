import { useEffect, useRef, useState } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import { getIdToken } from 'firebase/auth'
import { auth } from '../firebase/config'
import useInventoryProducts from '../hooks/orders/useInventoryProducts'
import GarmentEditor from '../components/GarmentEditor'
import OrderAIValidationDetails from '../components/OrderAIValidationDetails'
import { notify } from '../services/toastStore'
import {
  CATEGORIES,
  categoryOf,
  AREA_OPTIONS,
  AREA_LABELS,
  areaKeys,
  imageKey,
  money,
  validAmount,
  today,
} from '../services/businessModel'
import { localDateValue } from '../services/orderFormatting'
import { readImage, persistImage, cleanUploads } from '../services/imageFiles'
import { saveBusinessOrder } from '../services/businessOrders'
import '../styles/CreateOrderPage.css'
import '../styles/BusinessPages.css'

const emptyImages = { front: '', back: '', leftSleeve: '', rightSleeve: '' }
function getInitial(order) {
  return {
    category: order ? categoryOf(order) : '',
    customerName: order?.customerName || '',
    phone: order?.phone || '',
    orderDate: localDateValue(order?.orderDate || order?.createdAt) || today(),
    expectedDeliveryDate: localDateValue(order?.expectedDeliveryDate),
    garmentSource: order?.garmentSource || 'inventory',
    productId: order?.productId || '',
    size: order?.size || '',
    quantity: order?.quantity || 1,
    technique: order?.technique || '',
    customizationSide: order?.customizationSide || '',
    unitBasePrice:
      order?.unitBasePrice != null ? String(order.unitBasePrice) : '',
    paymentPlan: order?.paymentPlan || 'anticipo_50',
    description:
      order?.description || order?.customerGarment?.description || '',
    customerGarmentType: order?.customerGarment?.type || '',
    customerGarmentColor: order?.customerGarment?.color || '',
    title: order?.productName || '',
    personalizationSize: order?.personalizationSize || '',
  }
}
export default function CreateOrderPage() {
  const location = useLocation()
  return <OrderForm key={location.key} order={location.state?.orderToEdit} />
}
function OrderForm({ order }) {
  const navigate = useNavigate()
  const [form, setForm] = useState(() => getInitial(order))
  const [images, setImages] = useState(() => ({
    ...emptyImages,
    front: order?.customerGarmentImage || '',
    back: order?.customerGarmentImage || '',
    ...order?.customerGarment?.images,
  }))
  const [attachments, setAttachments] = useState(
    () => order?.referenceImages || [],
  )
  const [elements, setElements] = useState(() => order?.elements || [])
  const [areaDetails, setAreaDetails] = useState(
    () =>
      order?.areaDetails ||
      Object.fromEntries(
        areaKeys(order?.customizationSide).map((s, i) => [
          s,
          {
            size:
              (i === 0
                ? order.personalizationSize
                : order.personalizationSizeBack) || '',
            surcharge: String(
              (i === 0
                ? (order.personalizationSurchargeFront ??
                  order.personalizationSurcharge)
                : order.personalizationSurchargeBack) ?? '',
            ),
          },
        ]),
      ),
  )
  const [ai, setAi] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [saving, setSaving] = useState(false)
  const editor = useRef(null),
    busy = useRef(false),
    fileBusy = useRef(false)
  const { inventoryProducts, loadingProducts, productsError, reloadProducts } =
    useInventoryProducts()
  const products = inventoryProducts.filter(
    (p) => categoryOf(p) === form.category,
  )
  const product = products.find((p) => p.id === form.productId)
  const garment = form.category === 'prenda',
    advertising = form.category === 'publicidad'
  const fromInventory =
    !advertising && (!garment || form.garmentSource === 'inventory')
  const sides = areaKeys(form.customizationSide)
  const quantity = advertising ? 1 : Number(form.quantity)
  const base = Number(form.unitBasePrice || 0)
  const surcharge = garment
    ? sides.reduce((sum, s) => sum + Number(areaDetails[s]?.surcharge || 0), 0)
    : 0
  const unitPrice = money(base + surcharge),
    total = money(unitPrice * quantity)
  const planned = money(form.paymentPlan === 'completo' ? total : total * 0.5)
  const signature = JSON.stringify({
    size: form.size,
    quantity,
    technique: form.technique,
    side: form.customizationSide,
    productId: form.productId,
    type: form.customerGarmentType,
    color: form.customerGarmentColor,
    description: form.description,
    images,
    elements,
    areaDetails,
    productImages: product?.images,
    productType: product?.type,
    productColor: product?.color,
    source: form.garmentSource,
  })
  const latestSignature = useRef(signature)
  useEffect(() => {
    latestSignature.current = signature
  }, [signature])
  const aiCurrent = ai?.signature === signature
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const selectProduct = (id) => {
    const p = products.find((p) => p.id === id)
    setForm((prev) => ({
      ...prev,
      productId: id,
      size: p?.size || p?.sizes?.[0] || '',
      technique: '',
      customizationSide: '',
    }))
    setElements([])
    setAi(null)
  }
  const changeCategory = (value) => {
    setForm((prev) => ({
      ...getInitial(),
      customerName: prev.customerName,
      phone: prev.phone,
      orderDate: prev.orderDate,
      expectedDeliveryDate: prev.expectedDeliveryDate,
      category: value,
    }))
    setImages(emptyImages)
    setAttachments([])
    setElements([])
    setAreaDetails({})
    setAi(null)
  }
  const validateFields = () => {
    if (!Object.hasOwn(CATEGORIES, form.category))
      throw new Error('Selecciona el tipo de pedido.')
    if (!form.customerName.trim() || !/^\d{7,8}$/.test(form.phone))
      throw new Error('Ingresa el nombre y un teléfono de 7 u 8 dígitos.')
    if (
      !localDateValue(form.orderDate) ||
      !localDateValue(form.expectedDeliveryDate) ||
      form.expectedDeliveryDate < form.orderDate
    )
      throw new Error('Revisa la fecha de toma y la fecha prevista de entrega.')
    if (!Number.isInteger(quantity) || quantity <= 0)
      throw new Error('La cantidad debe ser un número entero mayor que cero.')
    if (!validAmount(form.unitBasePrice) || !Number.isFinite(total))
      throw new Error('Ingresa un precio válido, igual o mayor a cero.')
    if (fromInventory && (!product || product.legacyMultiSize))
      throw new Error(
        'Selecciona un producto válido con inventario individual.',
      )
    if (advertising && !form.description.trim())
      throw new Error('Describe el trabajo de publicidad.')
    if (garment) {
      if (!form.size.trim() || !form.technique || !sides.length)
        throw new Error('Completa talla, técnica y área.')
      if (
        fromInventory &&
        (!product.allowedTechniques.includes(form.technique) ||
          !product.availableSides.includes(form.customizationSide))
      )
        throw new Error(
          'La técnica o el área no están habilitadas para esta prenda.',
        )
      if (
        !fromInventory &&
        (!form.customerGarmentType.trim() ||
          !form.customerGarmentColor.trim() ||
          sides.some((s) => !images[imageKey(s)]))
      )
        throw new Error(
          'Completa la prenda del cliente y carga una fotografía por área seleccionada.',
        )
      if (
        sides.some(
          (s) =>
            !areaDetails[s]?.size?.trim() ||
            !validAmount(areaDetails[s]?.surcharge),
        )
      )
        throw new Error('Ingresa tamaño y recargo para cada área seleccionada.')
    }
  }
  const validateAI = async () => {
    if (loadingAI) return
    const requestSignature = signature
    try {
      validateFields()
      setLoadingAI(true)
      setAi(null)
      const preview = await editor.current.generatePreview()
      const response = await fetch(
        `${import.meta.env.VITE_API_URL || 'http://localhost:3001'}/api/ai/recommendation`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${await getIdToken(auth.currentUser)}`,
          },
          body: JSON.stringify({
            garmentSource: form.garmentSource,
            product:
              product?.name || form.description || form.customerGarmentType,
            productType: product?.type || form.customerGarmentType,
            productColor: product?.color || form.customerGarmentColor,
            size: form.size,
            technique: form.technique,
            quantity,
            customizationSide: form.customizationSide,
            customerGarmentDescription: form.description,
            previewImage: preview,
            elements: elements.map((element) => ({
              type: element.type,
              text: element.text || '',
              side: element.side || '',
              x: element.x,
              y: element.y,
              width: element.width || 0,
              height: element.height || 0,
            })),
          }),
        },
      )
      const data = await response.json()
      if (!response.ok)
        throw new Error(
          data.message || 'No se pudo validar la personalización.',
        )
      const result =
        typeof data.result === 'string' ? JSON.parse(data.result) : data.result
      if (!result || !result.riskLevel)
        throw new Error('La validación recibida no es válida.')
      if (latestSignature.current !== requestSignature)
        throw new Error(
          'El diseño cambió durante el análisis. Vuelve a validar.',
        )
      setAi({
        result,
        signature: requestSignature,
        at: new Date().toISOString(),
      })
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      setLoadingAI(false)
    }
  }
  const save = async (e) => {
    e.preventDefault()
    if (busy.current || fileBusy.current) return
    const uploaded = []
    try {
      validateFields()
      if (garment && !aiCurrent)
        throw new Error(
          'Valida la personalización con IA antes de guardar el pedido.',
        )
      busy.current = true
      setSaving(true)
      const referenceImages = []
      for (const image of attachments)
        referenceImages.push(
          await persistImage(image, 'order-references', uploaded),
        )
      const previewImage = garment
        ? await persistImage(
            await editor.current.generatePreview(),
            'orders',
            uploaded,
          )
        : referenceImages[0] || product?.images?.frente || ''
      const savedImages = {}
      if (garment && !fromInventory)
        for (const key of Object.keys(emptyImages))
          savedImages[key] = await persistImage(
            images[key],
            'customer-garments',
            uploaded,
          )
      const savedElements = []
      for (const el of elements)
        savedElements.push(
          el.type === 'image'
            ? {
                ...el,
                src: await persistImage(el.src, 'order-elements', uploaded),
              }
            : el,
        )
      const details = garment
        ? Object.fromEntries(
            sides.map((s) => [
              s,
              {
                size: areaDetails[s].size.trim(),
                surcharge: money(areaDetails[s].surcharge),
              },
            ]),
          )
        : {}
      const data = {
        category: form.category,
        customerName: form.customerName.trim(),
        phone: form.phone,
        orderDate: form.orderDate,
        expectedDeliveryDate: form.expectedDeliveryDate,
        garmentSource: fromInventory
          ? 'inventory'
          : advertising
            ? 'advertising'
            : 'customer',
        productId: fromInventory ? product.id : null,
        productName: advertising
          ? form.title.trim() || 'Trabajo de publicidad'
          : fromInventory
            ? product.name
            : form.customerGarmentType.trim(),
        productType: fromInventory
          ? product.type
          : garment
            ? form.customerGarmentType
            : 'publicidad',
        productColor: fromInventory
          ? product.color || ''
          : form.customerGarmentColor,
        description: form.description.trim(),
        size: garment ? form.size.trim() : '',
        quantity,
        technique: garment ? form.technique : '',
        customizationSide: garment ? form.customizationSide : '',
        areaDetails: details,
        personalizationSize: garment
          ? details[sides[0]].size
          : form.personalizationSize.trim(),
        personalizationSizeBack:
          garment && sides.length > 1 ? details[sides[1]].size : null,
        personalizationSurchargeFront: garment
          ? details[sides[0]].surcharge
          : 0,
        personalizationSurchargeBack:
          garment && sides.length > 1 ? details[sides[1]].surcharge : 0,
        personalizationSurcharge: money(surcharge),
        unitBasePrice: money(base),
        quotedUnitPrice: unitPrice,
        quoteTotal: total,
        paymentPlan: form.paymentPlan,
        previewImage,
        referenceImages,
        elements: garment ? savedElements : [],
        customerGarment:
          garment && !fromInventory
            ? {
                type: form.customerGarmentType.trim(),
                color: form.customerGarmentColor.trim(),
                description: form.description.trim(),
                images: savedImages,
              }
            : null,
        aiValidation: garment ? ai.result : null,
        aiValidatedAt: garment ? ai.at : null,
      }
      await saveBusinessOrder(data, order?.id)
      notify(
        order
          ? 'Pedido actualizado correctamente'
          : 'Pedido guardado correctamente',
        'success',
      )
      navigate('/historial')
    } catch (error) {
      await cleanUploads(uploaded)
      notify(error.message, 'error')
    } finally {
      busy.current = false
      setSaving(false)
    }
  }
  const uploadReferences = async (e) => {
    const files = Array.from(e.target.files || [])
    e.target.value = ''
    if (files.length + attachments.length > 8) {
      notify('Puedes agregar hasta 8 imágenes.', 'warning')
      return
    }
    fileBusy.current = true
    try {
      const values = await Promise.all(files.map(readImage))
      setAttachments((prev) => [...prev, ...values])
    } catch (error) {
      notify(error.message, 'error')
    } finally {
      fileBusy.current = false
    }
  }
  return (
    <form className="create-order-page business-form" onSubmit={save}>
      <div className="order-page-header">
        <div>
          <h2>{order ? 'Editar pedido' : 'Crear pedido'}</h2>
          <p>Completa los datos y revisa la cotización antes de guardar.</p>
        </div>
        <button
          type="submit"
          className="fab-save-button"
          disabled={saving || loadingAI}
          title="Guardar pedido"
          aria-label="Guardar pedido"
        >
          {saving ? '…' : '✓'}
        </button>
      </div>
      <fieldset disabled={saving}>
        <section className="order-section">
          <h3>Tipo de pedido</h3>
          <div className="category-options">
            {Object.entries(CATEGORIES).map(([value, label]) => (
              <label
                key={value}
                className={`category-option ${form.category === value ? 'selected' : ''}`}
              >
                <input
                  type="radio"
                  name="category"
                  value={value}
                  checked={form.category === value}
                  disabled={Boolean(order)}
                  onChange={() => changeCategory(value)}
                />
                {label}
              </label>
            ))}
          </div>
          {order && (
            <p className="form-text">
              La categoría de un pedido guardado se conserva.
            </p>
          )}
        </section>
        {form.category && (
          <>
            <section className="order-section">
              <h3>1 Información del cliente</h3>
              <div className="row g-3">
                <Field
                  label="Nombre del cliente"
                  value={form.customerName}
                  onChange={(v) => set('customerName', v)}
                  required
                />
                <Field
                  label="Teléfono"
                  value={form.phone}
                  onChange={(v) =>
                    set('phone', v.replace(/\D/g, '').slice(0, 8))
                  }
                  required
                />
                <Field
                  label="Fecha de toma del pedido"
                  type="date"
                  value={form.orderDate}
                  onChange={(v) => set('orderDate', v)}
                  required
                />
                <Field
                  label="Fecha prevista de entrega"
                  type="date"
                  value={form.expectedDeliveryDate}
                  onChange={(v) => set('expectedDeliveryDate', v)}
                  required
                />
              </div>
            </section>
            <section className="order-section">
              <h3>
                2{' '}
                {advertising
                  ? 'Trabajo de publicidad'
                  : 'Configuración del producto'}
              </h3>
              {garment && (
                <label className="form-label">
                  Origen de la prenda
                  <select
                    className="form-select"
                    value={form.garmentSource}
                    onChange={(e) => {
                      set('garmentSource', e.target.value)
                      set('productId', '')
                      setElements([])
                    }}
                  >
                    <option value="inventory">Producto del inventario</option>
                    <option value="customer">
                      Prenda proporcionada por el cliente
                    </option>
                  </select>
                </label>
              )}
              {fromInventory && (
                <>
                  <label className="form-label d-block">
                    Producto del inventario
                    <select
                      required
                      className="form-select"
                      value={form.productId}
                      onChange={(e) => selectProduct(e.target.value)}
                    >
                      <option value="">Seleccione</option>
                      {products.map((p) => (
                        <option
                          key={p.id}
                          value={p.id}
                          disabled={p.legacyMultiSize}
                        >
                          {p.name} / {p.size || p.color || ''} / Stock {p.stock}
                          {p.legacyMultiSize ? ' — separar tallas' : ''}
                        </option>
                      ))}
                    </select>
                  </label>
                  {loadingProducts && <p>Cargando productos...</p>}
                  {productsError && (
                    <div className="alert alert-danger">
                      No se pudo cargar el inventario.{' '}
                      <button type="button" onClick={reloadProducts}>
                        Reintentar
                      </button>
                    </div>
                  )}
                </>
              )}
              <div className="row g-3">
                {garment && !fromInventory && (
                  <>
                    <Field
                      label="Tipo de prenda"
                      value={form.customerGarmentType}
                      onChange={(v) => set('customerGarmentType', v)}
                      required
                    />
                    <Field
                      label="Color de la prenda"
                      value={form.customerGarmentColor}
                      onChange={(v) => set('customerGarmentColor', v)}
                      required
                    />
                  </>
                )}
                {garment && (
                  <Field
                    label="Talla"
                    value={form.size}
                    onChange={(v) => set('size', v)}
                    readOnly={fromInventory}
                    required
                  />
                )}
                {!advertising && (
                  <Field
                    label="Cantidad"
                    type="number"
                    value={form.quantity}
                    onChange={(v) => set('quantity', v)}
                    min="1"
                    step="1"
                    required
                  />
                )}
                {garment && (
                  <>
                    <label className="col-md-6">
                      Técnica
                      <select
                        required
                        className="form-select"
                        value={form.technique}
                        onChange={(e) => set('technique', e.target.value)}
                      >
                        <option value="">Seleccione</option>
                        {(fromInventory
                          ? product?.allowedTechniques || []
                          : ['DTF', 'Bordado', 'Sublimación', 'Vinil textil']
                        ).map((t) => (
                          <option key={t}>{t}</option>
                        ))}
                      </select>
                    </label>
                    <label className="col-md-6">
                      Área a personalizar
                      <select
                        required
                        className="form-select"
                        value={form.customizationSide}
                        onChange={(e) =>
                          set('customizationSide', e.target.value)
                        }
                      >
                        <option value="">Seleccione</option>
                        {AREA_OPTIONS.filter(
                          ([value]) =>
                            !fromInventory ||
                            product?.availableSides.includes(value),
                        ).map(([value, label]) => (
                          <option key={value} value={value}>
                            {label}
                          </option>
                        ))}
                      </select>
                    </label>
                  </>
                )}
                {advertising && (
                  <Field
                    label="Nombre del trabajo"
                    value={form.title}
                    onChange={(v) => set('title', v)}
                  />
                )}
                <label className="col-12">
                  Descripción o comentarios
                  <textarea
                    className="form-control"
                    rows="3"
                    maxLength={garment ? 300 : 2000}
                    value={form.description}
                    onChange={(e) => set('description', e.target.value)}
                    required={advertising}
                  />
                </label>
              </div>
            </section>
            <section className="order-section">
              <h3>3 Cotización y forma de pago</h3>
              <div className="row g-3">
                <Field
                  label={
                    advertising
                      ? 'Monto del trabajo (Q)'
                      : 'Precio base unitario (Q)'
                  }
                  type="number"
                  min="0"
                  step="0.01"
                  value={form.unitBasePrice}
                  onChange={(v) => set('unitBasePrice', v)}
                  required
                />
                {!garment && !advertising && (
                  <Field
                    label="Tamaño o especificaciones"
                    value={form.personalizationSize}
                    onChange={(v) => set('personalizationSize', v)}
                  />
                )}
                {garment &&
                  sides.map((side) => (
                    <div key={side} className="col-12">
                      <h6>{AREA_LABELS[side]}</h6>
                      <div className="row g-2">
                        <Field
                          label="Tamaño de la personalización"
                          value={areaDetails[side]?.size || ''}
                          onChange={(v) =>
                            setAreaDetails((prev) => ({
                              ...prev,
                              [side]: { ...prev[side], size: v },
                            }))
                          }
                          required
                        />
                        <Field
                          label="Recargo por unidad (Q)"
                          type="number"
                          min="0"
                          step="0.01"
                          value={areaDetails[side]?.surcharge ?? ''}
                          onChange={(v) =>
                            setAreaDetails((prev) => ({
                              ...prev,
                              [side]: { ...prev[side], surcharge: v },
                            }))
                          }
                          required
                        />
                      </div>
                    </div>
                  ))}
              </div>
              <div className="quote-total-banner mt-3">
                <span>Total cotizado</span>
                <strong>
                  Q{Number.isFinite(total) ? total.toFixed(2) : '0.00'}
                </strong>
              </div>
              <p className="form-text">
                {advertising
                  ? 'Monto total del trabajo.'
                  : 'El precio base más los recargos por unidad se multiplica por la cantidad.'}
              </p>
              <label>
                Forma de pago
                <select
                  className="form-select"
                  value={form.paymentPlan}
                  onChange={(e) => set('paymentPlan', e.target.value)}
                >
                  <option value="anticipo_50">Anticipo 50%</option>
                  <option value="completo">Pago completo</option>
                </select>
              </label>
              <div className="row mt-3">
                <p className="col">
                  Pago inicial previsto:{' '}
                  <strong>
                    Q{Number.isFinite(planned) ? planned.toFixed(2) : '0.00'}
                  </strong>
                </p>
                <p className="col">
                  Saldo previsto:{' '}
                  <strong>
                    Q
                    {Number.isFinite(total - planned)
                      ? money(total - planned).toFixed(2)
                      : '0.00'}
                  </strong>
                </p>
              </div>
            </section>
            {garment ? (
              <>
                <section className="order-section">
                  <h3>4 Personalización de la prenda</h3>
                  {!fromInventory && (
                    <div className="row g-3 mb-3">
                      {sides.map((side) => (
                        <label key={side} className="col-md-6">
                          Fotografía de {AREA_LABELS[side].toLowerCase()}
                          <input
                            type="file"
                            className="form-control"
                            accept="image/png,image/jpeg,image/webp"
                            onChange={async (e) => {
                              const file = e.target.files?.[0]
                              if (!file) return
                              try {
                                const value = await readImage(file)
                                setImages((prev) => ({
                                  ...prev,
                                  [imageKey(side)]: value,
                                }))
                              } catch (error) {
                                notify(error.message, 'error')
                              }
                              e.target.value = ''
                            }}
                          />
                          {images[imageKey(side)] && (
                            <img
                              className="reference-thumb"
                              src={images[imageKey(side)]}
                              alt={AREA_LABELS[side]}
                            />
                          )}
                        </label>
                      ))}
                    </div>
                  )}
                  <GarmentEditor
                    key={`${form.productId}-${form.garmentSource}`}
                    ref={editor}
                    product={fromInventory ? product : null}
                    customerGarmentImages={images}
                    customizationSide={form.customizationSide}
                    initialElements={elements}
                    onElementsChange={setElements}
                  />
                </section>
                <section className="order-section">
                  <h3>5 Validación inteligente</h3>
                  <p>
                    Valida el diseño actual antes de guardar con el check
                    amarillo.
                  </p>
                  <button
                    type="button"
                    className="ai-validation-button"
                    disabled={loadingAI || saving}
                    onClick={validateAI}
                  >
                    {loadingAI
                      ? 'Analizando personalización...'
                      : '✦ Validar personalización con IA'}
                  </button>
                  {aiCurrent && (
                    <OrderAIValidationDetails
                      validation={ai.result}
                      validatedAt={ai.at}
                    />
                  )}
                </section>
              </>
            ) : (
              <section className="order-section">
                <h3>4 Imágenes para la cotización</h3>
                <p>Agrega hasta 8 imágenes. Se incluirán en el PDF.</p>
                <input
                  type="file"
                  className="form-control"
                  multiple
                  accept="image/png,image/jpeg,image/webp"
                  onChange={uploadReferences}
                />
                <div className="reference-list">
                  {attachments.map((src, i) => (
                    <div key={`${src}-${i}`}>
                      <img
                        className="reference-thumb"
                        src={src}
                        alt={`Referencia ${i + 1}`}
                      />
                      <button
                        type="button"
                        className="btn btn-outline-danger btn-sm"
                        onClick={() =>
                          setAttachments((prev) =>
                            prev.filter((_, index) => index !== i),
                          )
                        }
                      >
                        Quitar imagen {i + 1}
                      </button>
                    </div>
                  ))}
                </div>
              </section>
            )}
            <div className="d-flex gap-2 mb-4">
              <button
                type="submit"
                className="btn btn-warning"
                disabled={saving || loadingAI}
              >
                {saving ? 'Guardando...' : '✓ Guardar pedido'}
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => navigate('/historial')}
              >
                Cancelar
              </button>
            </div>
          </>
        )}
      </fieldset>
    </form>
  )
}
function Field({ label, onChange, ...props }) {
  return (
    <label className="col-md-6">
      {label}
      <input
        className="form-control"
        {...props}
        onChange={(e) => onChange(e.target.value)}
      />
    </label>
  )
}
