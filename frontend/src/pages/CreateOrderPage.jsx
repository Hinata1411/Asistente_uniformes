import { useEffect, useState, useRef } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'
import useInventoryProducts from '../hooks/orders/useInventoryProducts'
import { getPersonalizationPricing } from '../services/pricingService'

import { db, storage } from '../firebase/config'

import {
  collection,
  addDoc,
  doc,
  runTransaction
} from 'firebase/firestore'

import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'

import GarmentEditor from '../components/GarmentEditor'
import CustomerGarmentForm from '../components/orders/CustomerGarmentForm'
import InventoryGarmentForm from '../components/orders/InventoryGarmentForm'
import GarmentSourceSelector from '../components/orders/GarmentSourceSelector'
import CustomerGarmentPreview from '../components/orders/CustomerGarmentPreview'
import { notify } from '../services/toastStore'

import './CreateOrderPage.css'

const localDateValue = (value) => {
  if (!value) return ''
  if (typeof value === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(value)) {
    const parsed = new Date(`${value}T12:00:00`)
    if (!Number.isFinite(parsed.getTime())) return ''
    const normalized = `${parsed.getFullYear()}-${String(parsed.getMonth() + 1).padStart(2, '0')}-${String(parsed.getDate()).padStart(2, '0')}`
    return normalized === value ? value : ''
  }
  try {
    const date = typeof value.toDate === 'function'
      ? value.toDate()
      : value.seconds != null
        ? new Date(value.seconds * 1000)
        : new Date(value)
    if (!Number.isFinite(date.getTime())) return ''
    return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`
  } catch { return '' }
}

function CreateOrderPage() {
  const location = useLocation()
  const navigate = useNavigate()

  const [editingOrder, setEditingOrder] = useState(null)
  const [aiResult, setAiResult] = useState(null)
  const [loadingAI, setLoadingAI] = useState(false)
  const [isSaving, setIsSaving] = useState(false)
  const garmentEditorRef = useRef(null)
  const [previewBase64, setPreviewBase64] = useState('')
  const [editorElements, setEditorElements] = useState([])

  /*
    Guarda la última versión de "elements" que el editor ya nos
    avisó, para poder detectar un cambio REAL hecho por la persona
    (y ahí sí invalidar la validación de IA guardada). El editor
    puede volver a avisar los mismos elementos sin que nada haya
    cambiado (por ejemplo al hidratar el diseño guardado al entrar
    a editar un pedido); si comparáramos siempre contra
    editingOrder.elements, cada uno de esos avisos repetidos volvía
    a "detectar" una diferencia y borraba la validación justo
    después de generarla.
  */
  const lastNotifiedElementsRef = useRef([])
  const [customerGarmentImage, setCustomerGarmentImage] = useState('')
  const {
    inventoryProducts,
    loadingProducts,
    productsError,
    reloadProducts
  } = useInventoryProducts()

  const initialForm = {
    garmentSource: 'inventory',

    orderDate: localDateValue(new Date()),
    expectedDeliveryDate: '',
    customerName: '',
    phone: '',

    productId: '',

    customerGarmentType: '',
    customerGarmentDescription: '',
    customerGarmentColor: '',
    customerGarmentPrice: '',

    size: '',
    quantity: 1,
    technique: '',
    customizationSide: '',

    personalizationSize: 'chico',
    personalizationSizeBack: 'chico',
    paymentPlan: 'anticipo_50'
  }

  const [form, setForm] = useState(initialForm)

  const [personalizationPricing, setPersonalizationPricing] = useState({})

  useEffect(() => {
    const loadPricing = async () => {
      try {
        const pricing = await getPersonalizationPricing()
        setPersonalizationPricing(pricing)
      } catch (error) {
        console.error(
          'Error cargando precios de personalización:',
          error
        )
      }
    }

    loadPricing()
  }, [])

  const selectedProduct = inventoryProducts.find(
    (item) => item.id === form.productId
  )

  const isInventoryGarment =
    form.garmentSource === 'inventory'

  const isCustomerGarment =
    form.garmentSource === 'customer'

  // =========================================
  // COTIZACIÓN (se recalcula en cada render)
  // =========================================

  const quantityForQuote = Number(form.quantity) || 0

  /*
    Si el cliente trae su propia prenda, el negocio no la vende:
    solo cobra la personalización. El precio base solo aplica
    a prendas de inventario.
  */
  const unitBasePrice = isInventoryGarment
    ? Number(selectedProduct?.price || 0)
    : 0

  const techniquePricing =
    personalizationPricing[form.technique]

  const isBothSides =
    form.customizationSide === 'ambos'

  const personalizationSurchargeFront = techniquePricing
    ? Number(
        techniquePricing[form.personalizationSize] || 0
      )
    : 0

  const personalizationSurchargeBack =
    isBothSides && techniquePricing
      ? Number(
          techniquePricing[form.personalizationSizeBack] || 0
        )
      : 0

  const personalizationSurcharge =
    personalizationSurchargeFront + personalizationSurchargeBack

  const missingPricingRule =
    Boolean(form.technique) && !techniquePricing

  const unitPrice = unitBasePrice + personalizationSurcharge

  const quoteTotal = unitPrice * quantityForQuote

  const depositPaid =
    form.paymentPlan === 'completo'
      ? quoteTotal
      : Math.round(quoteTotal * 0.5 * 100) / 100

  const balanceDue =
    Math.round((quoteTotal - depositPaid) * 100) / 100

  useEffect(() => {
    if (location.state?.orderToEdit) {
      const order = location.state.orderToEdit

      setForm({
        orderDate: localDateValue(order.orderDate) || localDateValue(order.createdAt),
        expectedDeliveryDate: localDateValue(order.expectedDeliveryDate),
        garmentSource:
          order.garmentSource || 'inventory',

        customerName:
          order.customerName || '',

        phone:
          order.phone || '',

        productId:
          order.productId || '',

        customerGarmentType:
          order.customerGarment?.type || '',

        customerGarmentDescription:
          order.customerGarment?.description || '',

        customerGarmentColor:
          order.customerGarment?.color || '',

        customerGarmentPrice:
          order.garmentSource === 'customer' &&
          order.unitBasePrice
            ? String(order.unitBasePrice)
            : '',

        size:
          order.size || '',

        quantity:
          order.quantity || 1,

        technique:
          order.technique || '',

        customizationSide:
          order.customizationSide || '',

        personalizationSize:
          order.personalizationSize || 'chico',

        personalizationSizeBack:
          order.personalizationSizeBack || 'chico',

        paymentPlan:
          order.paymentPlan || 'anticipo_50'
      })

      setEditingOrder(order)
      setAiResult(
        order.aiValidation || null
      )
      setEditorElements(
        order.elements || []
      )
      lastNotifiedElementsRef.current =
        order.elements || []

      window.scrollTo(0, 0)
    }
  }, [location.state])

  const resetForm = () => {
    setForm({ ...initialForm, orderDate: localDateValue(new Date()) })
    setAiResult(null)
    setPreviewBase64('')
    setEditorElements([])
    lastNotifiedElementsRef.current = []
    setCustomerGarmentImage('')
    setEditingOrder(null)
  }

  const handleSaveOrder = async (order) => {
    // Evita duplicar el pedido si el botón se presiona varias veces
    // mientras la operación anterior todavía se está guardando.
    if (isSaving) return

    setIsSaving(true)

  try {
    if (!localDateValue(form.orderDate) || !localDateValue(form.expectedDeliveryDate)) {
      notify('Indica una fecha válida de toma del pedido y de entrega prevista.', 'warning')
      return
    }
    if (form.expectedDeliveryDate < form.orderDate) {
      notify('La entrega prevista no puede ser anterior a la toma del pedido.', 'warning')
      return
    }

    const requestedQuantity =
      Number(form.quantity)

    // =========================================
    // VALIDACIONES GENERALES
    // =========================================

    if (
      !form.customerName ||
      !form.phone ||
      !form.size ||
      !form.technique ||
      !form.customizationSide
    ) {
      notify(
        'Completa todos los datos del pedido',
        'warning'
      )
      return
    }

    if (!/^[\p{L}\s'-]+$/u.test(form.customerName.trim())) {
      notify(
        'El nombre del cliente solo puede contener letras, sin números.',
        'warning'
      )
      return
    }

    if (!/^\d{7,8}$/.test(form.phone)) {
      notify(
        'El teléfono debe contener solo números (7 u 8 dígitos), sin letras ni espacios.',
        'warning'
      )
      return
    }

    if (
      isInventoryGarment &&
      !form.productId
    ) {
      notify(
        'Selecciona un producto del inventario',
        'warning'
      )
      return
    }

    if (
      isInventoryGarment &&
      !selectedProduct
    ) {
      notify(
        'Selecciona un producto válido del inventario',
        'warning'
      )
      return
    }

    if (
      isCustomerGarment &&
      (
        !form.customerGarmentType ||
        !form.customerGarmentColor ||
        !customerGarmentImage
      )
    ) {
      notify(
        'Completa los datos de la prenda del cliente y carga una fotografía',
        'warning'
      )
      return
    }

    /*
      El precio base solo es obligatorio cuando la prenda es del
      inventario (es lo que el negocio vende). Si el cliente trae
      su propia prenda, el precio base es 0 y no se pide.
    */
    if (
      isInventoryGarment &&
      unitBasePrice <= 0
    ) {
      notify(
        'El producto seleccionado no tiene precio configurado. Definilo en Productos antes de continuar.',
        'warning'
      )
      return
    }

    if (missingPricingRule) {
      notify(
        `No hay precios de personalización configurados para la técnica "${form.technique}". Revisa la colección pricingRules en Firestore.`,
        'error'
      )
      return
    }

    if (
      !requestedQuantity ||
      requestedQuantity <= 0
    ) {
      notify(
        'La cantidad debe ser mayor a 0',
        'warning'
      )
      return
    }

    if (
      isInventoryGarment &&
      requestedQuantity >
        Number(selectedProduct.stock || 0)
    ) {
      /*
        Esta validación es útil como aviso rápido.

        La transacción volverá a comprobar el stock
        real antes de guardar.
      */
      if (!editingOrder) {
        notify(
          `La cantidad solicitada supera el stock disponible (${selectedProduct.stock})`,
          'warning'
        )
        return
      }
    }

    if (!order?.previewImage) {
      notify(
        'Debes generar una vista previa de la prenda',
        'warning'
      )
      return
    }

    if (!aiResult) {
      notify(
        'Debes validar el pedido con IA antes de guardarlo',
        'warning'
      )
      return
    }

    const orderElements =
      order.elements ||
      editorElements ||
      []

    // =========================================
    // DATOS DE LA PRENDA
    // =========================================

    const garmentData = {
      garmentSource:
        form.garmentSource,

      productId:
        isInventoryGarment
          ? selectedProduct.id
          : null,

      productName:
        isInventoryGarment
          ? selectedProduct.name
          : form.customerGarmentDescription ||
            form.customerGarmentType,

      productType:
        isInventoryGarment
          ? selectedProduct.type
          : form.customerGarmentType,

      productColor:
        isInventoryGarment
          ? selectedProduct.color
          : form.customerGarmentColor,

      customerGarment:
        isCustomerGarment
          ? {
              type:
                form.customerGarmentType,

              description:
                form.customerGarmentDescription,

              color:
                form.customerGarmentColor
            }
          : null
    }

    // =========================================
    // EDITAR PEDIDO EXISTENTE
    // =========================================

    if (editingOrder) {
      const oldProductId =
        editingOrder.productId || null

      const oldQuantity =
        Number(
          editingOrder.quantity || 0
        )

      /*
        También soportamos pedidos antiguos que
        todavía no tenían garmentSource pero sí
        tenían productId.
      */
      const oldIsInventory =
        Boolean(oldProductId) &&
        (
          editingOrder.garmentSource ===
            'inventory' ||
          !editingOrder.garmentSource
        )

      const newProductId =
        isInventoryGarment
          ? selectedProduct.id
          : null

      /*
        Subir la vista previa actualizada del editor ANTES de la
        transacción (igual que al crear un pedido nuevo). Si no se
        hace esto, el diseño editado se guarda pero el historial,
        el mensaje de WhatsApp y el PDF siguen mostrando la imagen
        vieja de antes de editar.
      */
      const previewPath =
        `orders/${Date.now()}.png`

      const previewStorageRef =
        ref(
          storage,
          previewPath
        )

      await uploadString(
        previewStorageRef,
        order.previewImage,
        'data_url'
      )

      const previewImageUrl =
        await getDownloadURL(
          previewStorageRef
        )

      await runTransaction(
        db,
        async (transaction) => {
          const orderRef =
            doc(
              db,
              'orders',
              editingOrder.id
            )

          const oldProductRef =
            oldIsInventory
              ? doc(
                  db,
                  'products',
                  oldProductId
                )
              : null

          const newProductRef =
            isInventoryGarment
              ? doc(
                  db,
                  'products',
                  newProductId
                )
              : null

          let oldProductSnap = null
          let newProductSnap = null

          // =====================================
          // LEER PRODUCTOS ANTES DE ESCRIBIR
          // =====================================

          if (
            oldProductRef &&
            newProductRef &&
            oldProductId === newProductId
          ) {
            oldProductSnap =
              await transaction.get(
                oldProductRef
              )

            newProductSnap =
              oldProductSnap
          } else {
            if (oldProductRef) {
              oldProductSnap =
                await transaction.get(
                  oldProductRef
                )
            }

            if (newProductRef) {
              newProductSnap =
                await transaction.get(
                  newProductRef
                )
            }
          }

          // =====================================
          // MISMO PRODUCTO DE INVENTARIO
          // =====================================

          if (
            oldIsInventory &&
            isInventoryGarment &&
            oldProductId === newProductId
          ) {
            if (!newProductSnap?.exists()) {
              throw new Error(
                'El producto del inventario ya no existe.'
              )
            }

            const currentStock =
              Number(
                newProductSnap.data()
                  .stock || 0
              )

            /*
              Si antes pedía 2 y ahora pide 4:
              necesitamos descontar únicamente 2.

              Si antes pedía 4 y ahora pide 2:
              devolvemos 2 al inventario.
            */
            const difference =
              requestedQuantity -
              oldQuantity

            if (
              difference > 0 &&
              difference > currentStock
            ) {
              throw new Error(
                `Stock insuficiente. Solo hay ${currentStock} unidades adicionales disponibles.`
              )
            }

            const newStock =
              currentStock -
              difference

            if (newStock < 0) {
              throw new Error(
                'El stock no puede quedar negativo.'
              )
            }

            transaction.update(
              newProductRef,
              {
                stock: newStock
              }
            )
          }

          // =====================================
          // CAMBIÓ DE PRODUCTO O DE ORIGEN
          // =====================================

          else {
            /*
              Si el pedido anterior utilizaba
              inventario, devolvemos su cantidad.
            */
            if (
              oldIsInventory &&
              oldProductRef
            ) {
              if (
                !oldProductSnap?.exists()
              ) {
                throw new Error(
                  'El producto anterior ya no existe en inventario.'
                )
              }

              const oldCurrentStock =
                Number(
                  oldProductSnap.data()
                    .stock || 0
                )

              transaction.update(
                oldProductRef,
                {
                  stock:
                    oldCurrentStock +
                    oldQuantity
                }
              )
            }

            /*
              Si el pedido nuevo utiliza inventario,
              descontamos la nueva cantidad.
            */
            if (
              isInventoryGarment &&
              newProductRef
            ) {
              if (
                !newProductSnap?.exists()
              ) {
                throw new Error(
                  'El producto seleccionado no existe en inventario.'
                )
              }

              const newCurrentStock =
                Number(
                  newProductSnap.data()
                    .stock || 0
                )

              if (
                requestedQuantity >
                newCurrentStock
              ) {
                throw new Error(
                  `Stock insuficiente. Solo hay ${newCurrentStock} unidades disponibles.`
                )
              }

              transaction.update(
                newProductRef,
                {
                  stock:
                    newCurrentStock -
                    requestedQuantity
                }
              )
            }
          }

          // =====================================
          // ACTUALIZAR PEDIDO
          // =====================================

          transaction.update(
            orderRef,
            {
              orderDate: form.orderDate,
              expectedDeliveryDate: form.expectedDeliveryDate,
              customerName:
                form.customerName,

              phone:
                form.phone,

              ...garmentData,

              size:
                form.size,

              quantity:
                requestedQuantity,

              technique:
                form.technique,

              customizationSide:
                form.customizationSide,

              elements:
                orderElements,

              previewImage:
                previewImageUrl,

              previewPath,

              aiValidation:
                aiResult,

              aiValidatedAt:
                new Date().toISOString(),

              unitBasePrice,

              personalizationSize:
                form.personalizationSize,

              personalizationSizeBack:
                isBothSides ? form.personalizationSizeBack : null,

              personalizationSurchargeFront,

              personalizationSurchargeBack:
                isBothSides ? personalizationSurchargeBack : 0,

              personalizationSurcharge,

              quotedUnitPrice:
                unitPrice,

              quoteTotal,

              paymentPlan:
                form.paymentPlan,

              depositPaid,

              balanceDue,

              updatedAt:
                new Date().toISOString()
            }
          )
        }
      )

      /*
        Limpieza de mejor esfuerzo: borrar en Storage la vista
        previa anterior (ya reemplazada) para no dejar imágenes
        huérfanas. Si falla, no debe impedir que la edición ya
        guardada se dé por exitosa.
      */
      const oldPreviewRef =
        editingOrder.previewPath ||
        editingOrder.previewImage

      if (
        oldPreviewRef &&
        oldPreviewRef !== previewPath
      ) {
        try {
          await deleteObject(
            ref(
              storage,
              oldPreviewRef
            )
          )
        } catch (storageError) {
          console.warn(
            'No se pudo eliminar la vista previa anterior en Storage:',
            storageError
          )
        }
      }

      await reloadProducts()

      notify(
        'Pedido actualizado correctamente',
        'success'
      )

      resetForm()
      navigate('/historial')
      return
    }

    // =========================================
    // SUBIR VISTA PREVIA
    // =========================================

    const previewPath =
      `orders/${Date.now()}.png`

    const storageRef =
      ref(
        storage,
        previewPath
      )

    await uploadString(
      storageRef,
      order.previewImage,
      'data_url'
    )

    const previewImageUrl =
      await getDownloadURL(
        storageRef
      )

    // =========================================
    // NUEVO PEDIDO
    // =========================================

    const newOrder = {
      orderDate: form.orderDate,
      expectedDeliveryDate: form.expectedDeliveryDate,
      customerName:
        form.customerName,

      phone:
        form.phone,

      ...garmentData,

      size:
        form.size,

      quantity:
        requestedQuantity,

      technique:
        form.technique,

      customizationSide:
        form.customizationSide,

      elements:
        orderElements,

      previewImage:
        previewImageUrl,

      previewPath,

      aiValidation:
        aiResult,

      aiValidatedAt:
        new Date().toISOString(),

      // =========================================
      // COTIZACIÓN Y PAGO
      // =========================================

      unitBasePrice,

      personalizationSize:
        form.personalizationSize,

      personalizationSizeBack:
        isBothSides ? form.personalizationSizeBack : null,

      personalizationSurchargeFront,

      personalizationSurchargeBack:
        isBothSides ? personalizationSurchargeBack : 0,

      personalizationSurcharge,

      quotedUnitPrice:
        unitPrice,

      quoteTotal,

      paymentPlan:
        form.paymentPlan,

      // Importe previsto; se confirma al aprobar.
      initialPaymentAmount: depositPaid,

      // El pedido todavía está pendiente de aprobación.
      depositPaid: 0,
      balanceDue: quoteTotal,
      status: 'pendiente_aprobacion',

      createdAt:
        new Date().toISOString()
    }

    // =========================================
    // PEDIDO CON PRENDA DE INVENTARIO
    // =========================================

    if (isInventoryGarment) {
      await runTransaction(
        db,
        async (transaction) => {
          const productRef =
            doc(
              db,
              'products',
              selectedProduct.id
            )

          const productSnap =
            await transaction.get(
              productRef
            )

          if (!productSnap.exists()) {
            throw new Error(
              'El producto seleccionado ya no existe.'
            )
          }

          const currentStock =
            Number(
              productSnap.data()
                .stock || 0
            )

          if (
            requestedQuantity >
            currentStock
          ) {
            throw new Error(
              `Stock insuficiente. Solo hay ${currentStock} unidades disponibles.`
            )
          }

          const newStock =
            currentStock -
            requestedQuantity

          if (newStock < 0) {
            throw new Error(
              'El stock no puede quedar negativo.'
            )
          }

          const newOrderRef =
            doc(
              collection(
                db,
                'orders'
              )
            )

          transaction.update(
            productRef,
            {
              stock:
                newStock
            }
          )

          transaction.set(
            newOrderRef,
            newOrder
          )
        }
      )
    }

    // =========================================
    // PRENDA PROPORCIONADA POR EL CLIENTE
    // =========================================

    else {
      await addDoc(
        collection(
          db,
          'orders'
        ),
        newOrder
      )
    }

    await reloadProducts()

    notify(
      'Pedido guardado correctamente',
      'success'
    )

    resetForm()
    navigate('/historial')
  } catch (error) {
    console.error(
      'Error guardando pedido:',
      error
    )

    notify(
      `Ocurrió un error al guardar el pedido: ${error.message}`,
      'error'
    )
  } finally {
    setIsSaving(false)
  }
}
  const handleGenerateAI = async () => {
    try {
      const isInventoryGarment =
        form.garmentSource === 'inventory'

      const isCustomerGarment =
        form.garmentSource === 'customer'

      if (
        !form.size ||
        !form.technique ||
        !form.quantity ||
        !form.customizationSide
      ) {
        notify(
          'Completa talla, técnica, cantidad y área de personalización',
          'warning'
        )
        return
      }

      if (
        isInventoryGarment &&
        !selectedProduct
      ) {
        notify(
          'Selecciona un producto válido del inventario',
          'warning'
        )
        return
      }

      if (
        isCustomerGarment &&
        (
          !form.customerGarmentType ||
          !form.customerGarmentColor ||
          !customerGarmentImage
        )
      ) {
        notify(
          'Completa los datos de la prenda del cliente y carga una fotografía',
          'warning'
        )
        return
      }

      if (form.quantity <= 0) {
        notify(
          'La cantidad debe ser mayor a 0',
          'warning'
        )
        return
      }

      if (
        isInventoryGarment &&
        form.quantity > selectedProduct.stock
      ) {
        notify(
          `Solo hay ${selectedProduct.stock} unidades disponibles`,
          'warning'
        )
        return
      }

      setLoadingAI(true)
      setAiResult(null)

      const response =
        await fetch(
          'http://localhost:3001/api/ai/recommendation',
          {
            method: 'POST',

            headers: {
              'Content-Type':
                'application/json'
            },

            body:
              JSON.stringify({
                garmentSource:
                  form.garmentSource,

                product:
                  isInventoryGarment
                    ? selectedProduct.name
                    : form.customerGarmentDescription ||
                      form.customerGarmentType,

                productType:
                  isInventoryGarment
                    ? selectedProduct.type
                    : form.customerGarmentType,

                productColor:
                  isInventoryGarment
                    ? selectedProduct.color
                    : form.customerGarmentColor,

                size:
                  form.size,

                technique:
                  form.technique,

                quantity:
                  form.quantity,

                customizationSide:
                  form.customizationSide,

                customerGarmentDescription:
                  isCustomerGarment
                    ? form.customerGarmentDescription
                    : '',

                previewImage:
                  previewBase64,

                elements:
                  editorElements
              })
          }
        )

      if (!response.ok) {
        const errorData =
          await response
            .json()
            .catch(() => null)

        throw new Error(
          errorData?.message ||
          'Error en la respuesta del servidor'
        )
      }

      const data =
        await response.json()

      let result =
        data.result

      if (
        typeof result === 'string'
      ) {
        result =
          JSON.parse(result)
      }

      if (
        result?.text &&
        typeof result.text === 'string'
      ) {
        result =
          JSON.parse(
            result.text
          )
      }

      setAiResult(result)
    } catch (error) {
      console.error(
        'Error con IA:',
        error
      )

      notify(
        `Error con IA: ${error.message}`,
        'error'
      )
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

      {/* BOTÓN DE GUARDAR CIRCULAR FIJO (visible siempre, del inicio al final) */}
      <button
        type="button"
        className={`fab-save-button ${isSaving ? 'is-saving' : ''}`}
        disabled={isSaving}
        title={
          editingOrder
            ? 'Guardar cambios del pedido'
            : 'Guardar pedido'
        }
        aria-label={
          editingOrder
            ? 'Guardar cambios del pedido'
            : 'Guardar pedido'
        }
        onClick={() =>
          garmentEditorRef.current?.triggerSave()
        }
      >
        {isSaving ? (
          <span className="fab-spinner" aria-hidden="true" />
        ) : (
          <svg
            width="26"
            height="26"
            viewBox="0 0 24 24"
            fill="none"
            aria-hidden="true"
          >
            <path
              d="M4 12.5L9.5 18L20 6"
              stroke="#1a1a1a"
              strokeWidth="3"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        )}
      </button>

      {/* PASO 1 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number">
            1
          </span>

          <div>
            <h3>
              Información del cliente
            </h3>

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
              value={
                form.customerName
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  // Solo letras (con acentos/ñ), espacios, apóstrofe
                  // y guion: sin números ni otros símbolos.
                  customerName:
                    e.target.value.replace(/[^\p{L}\s'-]/gu, '')
                })
              }
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label">
              Teléfono
            </label>

            <input
              type="tel"
              inputMode="numeric"
              maxLength={8}
              className="form-control"
              placeholder="Ej. 55555555"
              value={
                form.phone
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  // Solo dígitos: el número se usa tal cual para
                  // armar el link de WhatsApp más adelante.
                  phone:
                    e.target.value.replace(/\D/g, '')
                })
              }
            />
          </div>

          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="orderDate">Fecha de toma del pedido</label>
            <input id="orderDate" type="date" className="form-control"
              value={form.orderDate} required
              readOnly={Boolean(editingOrder && (localDateValue(editingOrder.orderDate) || localDateValue(editingOrder.createdAt)))}
              onChange={(e) => setForm({ ...form, orderDate: e.target.value })}
            />
            {editingOrder && !localDateValue(editingOrder.orderDate) && !localDateValue(editingOrder.createdAt) && (
              <small className="text-muted">Este pedido antiguo no tiene fecha de toma. Indica la fecha correcta.</small>
            )}
          </div>
          <div className="col-12 col-md-6">
            <label className="form-label" htmlFor="expectedDeliveryDate">Fecha prevista de entrega</label>
            <input id="expectedDeliveryDate" type="date" className="form-control"
              value={form.expectedDeliveryDate} min={form.orderDate || undefined} required
              onChange={(e) => setForm({ ...form, expectedDeliveryDate: e.target.value })}
            />
            {form.expectedDeliveryDate && form.orderDate && form.expectedDeliveryDate < form.orderDate && (
              <small className="text-danger">La entrega no puede ser anterior a la toma del pedido.</small>
            )}
          </div>
        </div>
      </section>

      {/* PASO 2 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number">
            2
          </span>

          <div>
            <h3>
              Configuración del producto
            </h3>

            <p>
              Selecciona la prenda y las características del pedido.
            </p>
          </div>
        </div>

        <GarmentSourceSelector
          form={form}
          setForm={setForm}
          setAiResult={
            setAiResult
          }
          setPreviewBase64={
            setPreviewBase64
          }
          setEditorElements={
            setEditorElements
          }
        />

        {form.garmentSource ===
          'inventory' && (
          <InventoryGarmentForm
            form={form}
            setForm={setForm}
            selectedProduct={
              selectedProduct
            }
            inventoryProducts={
              inventoryProducts
            }
            setAiResult={
              setAiResult
            }
            setPreviewBase64={
              setPreviewBase64
            }
            setEditorElements={
              setEditorElements
            }
          />
        )}

        {form.garmentSource ===
          'customer' && (
          <CustomerGarmentForm
            form={form}
            setForm={setForm}
            setAiResult={
              setAiResult
            }
          />
        )}
      </section>

      {/* PASO 3: COTIZACIÓN */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number">
            3
          </span>

          <div>
            <h3>
              Cotización y forma de pago
            </h3>

            <p>
              Calculá el total del pedido según la prenda y la técnica de personalización.
            </p>
          </div>
        </div>

        {isInventoryGarment && (
          <p className="quote-hint">
            {selectedProduct
              ? `Precio de la prenda seleccionada: Q${Number(selectedProduct.price || 0).toFixed(2)}`
              : 'Seleccioná un producto del inventario para ver su precio.'}
          </p>
        )}

        {isCustomerGarment && (
          <p className="quote-hint">
            El cliente trae su propia prenda: solo se cobra la personalización (no hay precio base de la prenda).
          </p>
        )}

        <div className="row g-3 mb-2">
          <div className="col-12 col-md-4">
            <label className="form-label">
              {isBothSides
                ? 'Tamaño del diseño (frente)'
                : 'Tamaño de la personalización'}
            </label>

            <select
              className="form-select"
              value={form.personalizationSize}
              onChange={(e) =>
                setForm({
                  ...form,
                  personalizationSize: e.target.value
                })
              }
            >
              <option value="chico">Chico (8x10")</option>
              <option value="mediano">Mediano (16x20")</option>
              <option value="grande">Grande (30x23")</option>
            </select>
          </div>

          {isBothSides && (
            <div className="col-12 col-md-4">
              <label className="form-label">
                Tamaño del diseño (espalda)
              </label>

              <select
                className="form-select"
                value={form.personalizationSizeBack}
                onChange={(e) =>
                  setForm({
                    ...form,
                    personalizationSizeBack: e.target.value
                  })
                }
              >
                <option value="chico">Chico (8x10")</option>
                <option value="mediano">Mediano (16x20")</option>
                <option value="grande">Grande (30x23")</option>
              </select>
            </div>
          )}
        </div>

        {isBothSides && (
          <p className="quote-hint">
            El área es "Frente y espalda": se cobra un recargo de personalización por cada lado (pueden ser tamaños distintos).
          </p>
        )}

        {missingPricingRule && (
          <div className="alert alert-warning">
            No hay precios configurados en Firestore para la técnica "{form.technique}".
          </div>
        )}

        {unitPrice > 0 && (
          <div className="quote-summary">
            <div className="quote-breakdown">
              <div className="quote-row">
                <span>Precio base de la prenda</span>
                <strong>Q{unitBasePrice.toFixed(2)}</strong>
              </div>

              {!isBothSides && (
                <div className="quote-row">
                  <span>Recargo por personalización ({form.technique || 'sin técnica'}, {form.personalizationSize})</span>
                  <strong>Q{personalizationSurchargeFront.toFixed(2)}</strong>
                </div>
              )}

              {isBothSides && (
                <>
                  <div className="quote-row">
                    <span>Recargo frente ({form.technique || 'sin técnica'}, {form.personalizationSize})</span>
                    <strong>Q{personalizationSurchargeFront.toFixed(2)}</strong>
                  </div>

                  <div className="quote-row">
                    <span>Recargo espalda ({form.technique || 'sin técnica'}, {form.personalizationSizeBack})</span>
                    <strong>Q{personalizationSurchargeBack.toFixed(2)}</strong>
                  </div>
                </>
              )}

              <div className="quote-row">
                <span>Precio unitario</span>
                <strong>Q{unitPrice.toFixed(2)}</strong>
              </div>

              <div className="quote-row">
                <span>Cantidad</span>
                <strong>{quantityForQuote}</strong>
              </div>
            </div>

            <div className="quote-total-banner">
              <span>Total cotizado</span>
              <strong>Q{quoteTotal.toFixed(2)}</strong>
            </div>

            <div className="quote-payment-plan">
              <p className="quote-section-label">Forma de pago</p>

              <div className="quote-payment-options">
                <label
                  className={`quote-payment-card ${form.paymentPlan === 'anticipo_50' ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="paymentPlan"
                    value="anticipo_50"
                    checked={form.paymentPlan === 'anticipo_50'}
                    onChange={() =>
                      setForm({
                        ...form,
                        paymentPlan: 'anticipo_50'
                      })
                    }
                  />
                  <div>
                    <strong>Anticipo 50%</strong>
                    <span>Paga la mitad ahora y el resto al entregar</span>
                  </div>
                </label>

                <label
                  className={`quote-payment-card ${form.paymentPlan === 'completo' ? 'active' : ''}`}
                >
                  <input
                    type="radio"
                    name="paymentPlan"
                    value="completo"
                    checked={form.paymentPlan === 'completo'}
                    onChange={() =>
                      setForm({
                        ...form,
                        paymentPlan: 'completo'
                      })
                    }
                  />
                  <div>
                    <strong>Pago completo</strong>
                    <span>Paga el total del pedido ahora</span>
                  </div>
                </label>
              </div>
            </div>

            <div className="quote-payment-result">
              <div className="quote-stat quote-stat-now">
                <span>
                  {form.paymentPlan === 'completo'
                    ? 'Total a pagar ahora'
                    : 'Anticipo a pagar ahora (50%)'}
                </span>
                <strong>Q{depositPaid.toFixed(2)}</strong>
              </div>

              <div className="quote-stat quote-stat-balance">
                <span>Saldo pendiente</span>
                <strong>Q{balanceDue.toFixed(2)}</strong>
              </div>
            </div>
          </div>
        )}
      </section>

      {/* PASO 4 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number">
            4
          </span>

          <div>
            <h3>
              Personalización de la prenda
            </h3>

            <p>
              Agrega logos, imágenes o texto y ajusta su posición sobre la prenda.
            </p>
          </div>
        </div>

        {form.garmentSource ===
          'customer' && (
          <CustomerGarmentPreview
            form={form}
            onImageChange={
              (image) => {
                setCustomerGarmentImage(
                  image
                )
                setPreviewBase64('')
                setAiResult(null)
              }
            }
          />
        )}

        <GarmentEditor
          ref={
            garmentEditorRef
          }

          product={
            selectedProduct
          }

          customerGarmentImage={
            customerGarmentImage
          }

          customerGarment={{
            type:
              form.customerGarmentType,

            color:
              form.customerGarmentColor
          }}

          customizationSide={
            form.customizationSide
          }

          initialElements={
            editingOrder?.elements || []
          }

          onPreviewChange={
            (base64) =>
              setPreviewBase64(
                base64
              )
          }

          onElementsChange={
            (newElements) => {
              setEditorElements(
                newElements
              )

              /*
                Si estamos editando un pedido y la personalización
                ya cambió respecto a la última versión que vimos,
                la validación de IA anterior queda desactualizada:
                hay que forzar que se vuelva a validar antes de
                poder guardar.

                Importante: comparamos contra la última versión
                notificada (lastNotifiedElementsRef), NO contra
                editingOrder.elements directamente. El editor puede
                volver a avisar los mismos elementos sin que la
                persona haya cambiado nada (por ejemplo al hidratar
                el diseño guardado al entrar a editar), y comparar
                siempre contra editingOrder.elements hacía que esos
                avisos repetidos "detectaran" una diferencia y
                borraran la validación justo después de generarla.
              */
              const changed =
                JSON.stringify(newElements) !==
                JSON.stringify(
                  lastNotifiedElementsRef.current
                )

              lastNotifiedElementsRef.current =
                newElements

              if (
                editingOrder &&
                aiResult &&
                changed
              ) {
                setAiResult(null)
              }
            }
          }

          onSave={
            handleSaveOrder
          }
        />
      </section>

      {/* PASO 5 */}
      <section className="order-section">
        <div className="order-section-header">
          <span className="section-number ai-number">
            ✦
          </span>

          <div>
            <h3>
              Validación inteligente
            </h3>

            <p>
              Analiza la configuración y el diseño antes de registrar el pedido.
            </p>
          </div>
        </div>

        <button
          type="button"
          className="ai-validation-button"
          onClick={
            handleGenerateAI
          }
          disabled={
            loadingAI
          }
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
                Riesgo{' '}
                {aiResult.riskLevel ||
                  'no definido'}
              </span>
            </div>

            <div className="ai-result-grid">

              <div className="ai-result-item">
                <span>
                  Compatibilidad técnica
                </span>

                <strong>
                  {aiResult.techniqueCompatibility ||
                    'No especificado'}
                </strong>
              </div>

              <div className="ai-result-item">
                <span>
                  Ubicación detectada
                </span>

                <strong>
                  {aiResult.detectedPlacement ||
                    'No detectada'}
                </strong>
              </div>

              <div className="ai-result-item">
                <span>
                  Proporción visual
                </span>

                <strong>
                  {aiResult.visualFit ||
                    'No especificada'}
                </strong>
              </div>

              <div className="ai-result-item">
                <span>
                  Colores de producción
                </span>

                <strong>
                  {aiResult.productionColors?.length > 0
                    ? aiResult.productionColors.join(
                        ', '
                      )
                    : 'No especificados'}
                </strong>
              </div>

            </div>

            <div className="ai-detail-block">
              <h5>
                Recomendación general
              </h5>

              <p>
                {aiResult.recommendation ||
                  'Sin recomendación'}
              </p>
            </div>

            <div className="ai-detail-block">
              <h5>
                Mensaje para el cliente
              </h5>

              <p>
                {aiResult.clientMessage ||
                  'Sin mensaje'}
              </p>
            </div>

            <div className="ai-detail-block">
              <h5>
                Nota para producción
              </h5>

              <p>
                {aiResult.productionNote ||
                  'Sin nota'}
              </p>
            </div>

            <div className="row g-3">

              <div className="col-12 col-lg-6">
                <div className="ai-list-block">
                  <h5>
                    Tamaños recomendados
                  </h5>

                  <ul>
                    {aiResult.recommendedSizes?.length > 0 ? (
                      aiResult.recommendedSizes.map(
                        (
                          item,
                          index
                        ) => (
                          <li key={index}>
                            <strong>
                              {item.element}
                            </strong>

                            {' — '}

                            {
                              item.recommendedSize
                            }

                            {item.note
                              ? ` · ${item.note}`
                              : ''}
                          </li>
                        )
                      )
                    ) : (
                      <li>
                        No definidos
                      </li>
                    )}
                  </ul>
                </div>
              </div>

              <div className="col-12 col-lg-6">
                <div className="ai-list-block">
                  <h5>
                    Advertencias
                  </h5>

                  <ul>
                    {aiResult.warnings?.length > 0 ? (
                      aiResult.warnings.map(
                        (
                          warning,
                          index
                        ) => (
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

            </div>

          </div>
        )}
      </section>

    </div>
  )
}

export default CreateOrderPage