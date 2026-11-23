import { useInventoryTypes } from '../components/InventoryTypes'
import { useEffect, useState } from 'react'
import {
  useLocation,
  useNavigate,
  useParams
} from 'react-router-dom'

import {
  doc,
  getDoc,
  updateDoc
} from 'firebase/firestore'

import {
  ref,
  uploadBytes,
  getDownloadURL,
  deleteObject
} from 'firebase/storage'

import {
  db,
  storage
} from '../firebase/config'

import {
  createProduct
} from '../services/productsService'

import { notify } from '../services/toastStore'

import '../styles/CreateProductPage.css'

function CreateProductPage() {
  const navigate = useNavigate()
  const location = useLocation()
  const { id } = useParams()

  const productFromState =
    location.state?.productToEdit || null

  const isEditing =
    Boolean(id)

  const [form, setForm] = useState({
    category: 'prenda',
    name: '',
    type: '',
    color: '',
    stock: 0,
    price: 0,
    sizes: [],
    availableSides: [],
    allowedTechniques: []
  })

  const isGarment = form.category === 'prenda'
  const { types, loading: loadingTypes, error: typesError } = useInventoryTypes(form.category)
  const availableTypes = types.filter(type => !type.inactive || type.id === form.type)

  const [
    frontImageFile,
    setFrontImageFile
  ] = useState(null)

  const [
    backImageFile,
    setBackImageFile
  ] = useState(null)

  const [
    frontPreview,
    setFrontPreview
  ] = useState('')

  const [
    backPreview,
    setBackPreview
  ] = useState('')

  const [
    loading,
    setLoading
  ] = useState(false)

  const [
    loadingProduct,
    setLoadingProduct
  ] = useState(isEditing)

  const sizeOptions = ['2', '4', '6', '8', '10', '12', '14', '16', 'XS', 'S', 'M', 'L', 'XL', '2XL', '3XL']
  const legacyMultiSize = isEditing && form.sizes.length > 1
  const [sleeveFiles, setSleeveFiles] = useState({})
  const [sleeveImages, setSleeveImages] = useState({})
  const sleeves = [
    { value: 'manga_izquierda', label: 'Manga izquierda' },
    { value: 'manga_derecha', label: 'Manga derecha' }
  ]
  const showFrontImage = !isGarment || form.availableSides.some(side => side === 'frente' || side === 'ambos')
  const showBackImage = isGarment && form.availableSides.some(side => side === 'espalda' || side === 'ambos')
  const [savedMainImages, setSavedMainImages] = useState({ front: '', back: '' })
  const requiredSleeves = isGarment ? sleeves.filter(({ value }) =>
    form.availableSides.includes(value) || form.availableSides.includes('mangas')
  ) : []

  const sideOptions = [
    {
      value: 'frente',
      label: 'Frente'
    },
    {
      value: 'espalda',
      label: 'Espalda'
    },
    {
      value: 'ambos',
      label: 'Frente y espalda'
    },
    ...sleeves,
    { value: 'mangas', label: 'Ambas mangas' }
  ]

  const techniqueOptions = [
    'DTF',
    'Bordado',
    'Sublimación',
    'Vinil textil'
  ]

  useEffect(() => {
    const loadProduct = async () => {
      if (!isEditing) {
        return
      }

      try {
        setLoadingProduct(true)

        let productData =
          productFromState

        if (!productData) {
          const productRef =
            doc(
              db,
              'products',
              id
            )

          const productSnap =
            await getDoc(
              productRef
            )

          if (!productSnap.exists()) {
            notify(
              'El producto no existe',
              'error'
            )

            navigate('/productos')
            return
          }

          productData = {
            id:
              productSnap.id,

            ...productSnap.data()
          }
        }

        setForm({
          category: productData.category || 'prenda',
          name:
            productData.name || '',

          type:
            productData.type || '',

          color:
            productData.color || '',

          stock:
            Number(
              productData.stock || 0
            ),

          price:
            Number(
              productData.price || 0
            ),

          sizes: productData.size
            ? [String(productData.size)]
            : Array.isArray(productData.sizes) ? productData.sizes.map(String) : [],

          availableSides:
            Array.isArray(
              productData.availableSides
            )
              ? productData.availableSides
              : [],

          allowedTechniques:
            Array.isArray(
              productData.allowedTechniques
            )
              ? productData.allowedTechniques
              : []
        })

        const frontImage =
          productData.images?.frente ||
          productData.frontImage ||
          ''

        const backImage =
          productData.images?.espalda ||
          productData.backImage ||
          ''

        setSavedMainImages({ front: frontImage, back: backImage })
        setSleeveImages({
          manga_izquierda: productData.images?.manga_izquierda || '',
          manga_derecha: productData.images?.manga_derecha || ''
        })

        setFrontPreview(
          frontImage
        )

        setBackPreview(
          backImage
        )
      } catch (error) {
        console.error(
          'Error cargando producto:',
          error
        )

        notify(
          'No se pudo cargar el producto',
          'error'
        )
      } finally {
        setLoadingProduct(false)
      }
    }

    loadProduct()
  }, [
    id,
    isEditing,
    navigate,
    productFromState
  ])

  const toggleArrayValue = (
    field,
    value
  ) => {
    setForm((prev) => {
      const currentValues =
        prev[field]

      const exists =
        currentValues.includes(value)

      return {
        ...prev,

        [field]:
          exists
            ? currentValues.filter(
                (item) =>
                  item !== value
              )
            : [
                ...currentValues,
                value
              ]
      }
    })
  }

  const validateImage = (
    file
  ) => {
    if (!file) {
      return false
    }

    const allowedTypes = [
      'image/png',
      'image/jpeg',
      'image/webp'
    ]

    if (
      !allowedTypes.includes(
        file.type
      )
    ) {
      notify(
        'La imagen debe ser PNG, JPG, JPEG o WEBP.',
        'warning'
      )

      return false
    }

    const maxSize =
      5 * 1024 * 1024

    if (
      file.size > maxSize
    ) {
      notify(
        'La imagen no puede superar los 5 MB.',
        'warning'
      )

      return false
    }

    return true
  }

  const handleFrontImage = (
    e
  ) => {
    const file =
      e.target.files?.[0]

    if (!file) {
      return
    }

    if (
      !validateImage(file)
    ) {
      e.target.value = ''
      return
    }

    setFrontImageFile(
      file
    )

    setFrontPreview(
      URL.createObjectURL(
        file
      )
    )
  }

  const handleBackImage = (
    e
  ) => {
    const file =
      e.target.files?.[0]

    if (!file) {
      return
    }

    if (
      !validateImage(file)
    ) {
      e.target.value = ''
      return
    }

    setBackImageFile(
      file
    )

    setBackPreview(
      URL.createObjectURL(
        file
      )
    )
  }

  const uploadProductImage =
    async (
      file,
      side,
      uploaded
    ) => {
      if (!file) {
        return ''
      }

      const safeFileName =
        file.name.replace(
          /[^a-zA-Z0-9._-]/g,
          '_'
        )

      const imagePath =
        `products/${Date.now()}-${side}-${safeFileName}`

      const imageRef =
        ref(
          storage,
          imagePath
        )

      await uploadBytes(
        imageRef,
        file
      )
      uploaded.push(imageRef)

      const downloadURL =
        await getDownloadURL(
          imageRef
        )

      return downloadURL
    }

  const handleSubmit = async (
    e
  ) => {
    e.preventDefault()

    if (
      !form.name.trim() ||
      !form.type.trim() ||
      form.stock < 0 ||
      !form.price ||
      Number(form.price) <= 0 ||
      (isGarment && (
        !form.color.trim() ||
        form.sizes.length === 0 ||
        form.availableSides.length === 0 ||
        form.allowedTechniques.length === 0
      ))
    ) {
      notify(
        'Completa todos los campos obligatorios',
        'warning'
      )

      return
    }

    if (showFrontImage && !frontImageFile && !savedMainImages.front) {
      notify(
        'Selecciona la imagen frontal del producto',
        'warning'
      )

      return
    }

    if (showBackImage && !backImageFile && !savedMainImages.back) {
      notify('Selecciona la imagen trasera del producto', 'warning')
      return
    }

    const missingSleeve = requiredSleeves.find(({ value }) => !sleeveFiles[value] && !sleeveImages[value])
    if (missingSleeve) {
      notify('Agrega la foto de ' + missingSleeve.label.toLowerCase() + '.', 'warning')
      return
    }

    const uploaded = []
    let saved = false
    try {
      setLoading(true)

      let frontImageUrl = savedMainImages.front
      let backImageUrl = savedMainImages.back

      if (showFrontImage && frontImageFile) {
        frontImageUrl =
          await uploadProductImage(
            frontImageFile,
            'front',
            uploaded
          )
      }

      if (showBackImage && backImageFile) {
        backImageUrl =
          await uploadProductImage(
            backImageFile,
            'back',
            uploaded
          )
      }

      const savedSleeves = { ...sleeveImages }
      for (const { value } of requiredSleeves) {
        if (sleeveFiles[value]) {
          savedSleeves[value] = await uploadProductImage(sleeveFiles[value], value, uploaded)
        }
      }

      const productData = {
        category: form.category,
        name:
          form.name.trim(),

        type:
          form.type.trim(),

        color:
          form.color.trim(),

        stock:
          Number(
            form.stock
          ),

        price:
          Number(
            form.price
          ),

        size: isGarment && form.sizes.length === 1 ? form.sizes[0] : '',
        sizes:
          isGarment ? form.sizes : [],

        availableSides:
          isGarment ? form.availableSides : [],

        allowedTechniques:
          isGarment ? form.allowedTechniques : [],

        images: {
          ...(isGarment ? savedSleeves : {}),
          frente:
            frontImageUrl,

          espalda:
            backImageUrl
        },

        frontImage:
          frontImageUrl,

        backImage:
          backImageUrl,

        updatedAt:
          new Date()
            .toISOString()
      }

      if (isEditing) {
        await updateDoc(
          doc(
            db,
            'products',
            id
          ),
          productData
        )

        saved = true
        notify(
          'Producto actualizado correctamente',
          'success'
        )
      } else {
        await createProduct({
          ...productData,

          createdAt:
            new Date()
              .toISOString()
        })

        saved = true
        notify(
          'Producto registrado correctamente',
          'success'
        )
      }

      navigate(
        '/productos'
      )
    } catch (error) {
      if (!saved) await Promise.allSettled(uploaded.map(imageRef => deleteObject(imageRef)))
      console.error(
        isEditing
          ? 'Error actualizando producto:'
          : 'Error creando producto:',
        error
      )

      notify(
        isEditing
          ? `No se pudo actualizar el producto: ${error.message}`
          : `No se pudo registrar el producto: ${error.message}`,
        'error'
      )
    } finally {
      setLoading(false)
    }
  }

  if (loadingProduct) {
    return (
      <div className="create-product-page">
        <div className="app-card p-4">
          Cargando producto...
        </div>
      </div>
    )
  }

  return (
    <div className="create-product-page">

      <div className="mb-4">
        <h2 className="page-title">
          {isEditing
            ? 'Editar artículo'
            : 'Nuevo artículo'}
        </h2>

        <p className="page-subtitle">
          {isEditing
            ? 'Actualiza la información de la prenda disponible para personalización.'
            : 'Registra una nueva prenda disponible para personalización.'}
        </p>
      </div>

      <form
        className="app-card p-4"
        onSubmit={
          handleSubmit
        }
      >
        <div className="row g-3">

          <label className="col-12 col-md-3">
            Categoría
            <select
              className="form-select"
              value={form.category}
              disabled={isEditing}
              onChange={(e) => setForm((previous) => ({
                ...previous,
                category: e.target.value,
                type: ''
              }))}
            >
              <option value="prenda">Prenda</option>
              <option value="producto">Producto</option>
            </select>
          </label>

          {/* NOMBRE */}

          <div className="col-12 col-md-6">
            <label className="form-label">
              Nombre del artículo
            </label>

            <input
              type="text"
              className="form-control"
              value={
                form.name
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  name:
                    e.target.value
                })
              }
              placeholder={isGarment ? 'Ej. Jersey Enduro Pro' : 'Ej. Taza blanca'}
              required
            />
          </div>

          {/* TIPO */}

          <div className="col-12 col-md-3">
            <label className="form-label">
              Tipo
            </label>

            {typesError && !isGarment ? (
              <input className="form-control" aria-label="Tipo" value={form.type}
                onChange={event => setForm(previous => ({ ...previous, type: event.target.value }))}
                required />
            ) : (
              <select className="form-select" aria-label="Tipo" value={form.type}
                onChange={event => setForm(previous => ({ ...previous, type: event.target.value }))} required>
                <option value="">Seleccione</option>
                {form.type && !availableTypes.some(type => type.id === form.type) && (
                  <option value={form.type}>{form.type}</option>
                )}
                {availableTypes.map(type => <option key={type.id} value={type.id}>{type.label}</option>)}
              </select>
            )}
            {loadingTypes && <div className="form-text">Cargando tipos...</div>}
            {typesError && <div className="form-text">El navegador no pudo abrir la lista de tipos.</div>}
            {!loadingTypes && !typesError && availableTypes.length === 0 && (
              <div className="form-text">Agrega un tipo desde Inventario → Editar tipos.</div>
            )}
          </div>

          {/* STOCK */}

          <div className="col-12 col-md-3">
            <label className="form-label">
              Stock
            </label>

            <input
              type="number"
              className="form-control"
              min="0"
              value={
                form.stock
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  stock:
                    Number(
                      e.target.value
                    )
                })
              }
              required
            />
          </div>

          {/* PRECIO */}

          <div className="col-12 col-md-3">
            <label className="form-label">
              Precio de venta (Q)
            </label>

            <input
              type="number"
              className="form-control"
              min="0"
              step="0.01"
              value={
                form.price
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  price:
                    e.target.value
                })
              }
              required
            />
          </div>

          {/* COLOR */}

          <div className="col-12 col-md-4">
            <label className="form-label">
              Color
            </label>

            <input
              type="text"
              className="form-control"
              value={
                form.color
              }
              onChange={(e) =>
                setForm({
                  ...form,
                  color:
                    e.target.value
                })
              }
              placeholder="Ej. Negro"
              required={isGarment}
            />
          </div>

          {isGarment && (
            <>
              <label className="col-12 col-md-6">
                Talla disponible
                {legacyMultiSize ? (
                  <>
                    <input className="form-control" value={form.sizes.join(', ')} readOnly />
                    <span className="form-text">
                      Este artículo comparte stock entre varias tallas. Crea un artículo por talla con sus existencias reales.
                    </span>
                  </>
                ) : (
                  <select className="form-select" value={form.sizes[0] || ''} required
                    onChange={event => setForm(previous => ({
                      ...previous,
                      sizes: event.target.value ? [event.target.value] : []
                    }))}>
                    <option value="">Seleccione una talla</option>
                    {form.sizes[0] && !sizeOptions.includes(form.sizes[0]) && (
                      <option value={form.sizes[0]}>{form.sizes[0]}</option>
                    )}
                    {sizeOptions.map(size => <option key={size} value={size}>{size}</option>)}
                  </select>
                )}
              </label>

              {/* ÁREAS */}

              <div className="col-12">
                <label className="form-label">
                  Áreas disponibles para personalización
                </label>

                <div className="option-group">
                  {sideOptions.map(
                    (side) => (
                      <label
                        key={
                          side.value
                        }
                        className="option-check"
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.availableSides.includes(
                              side.value
                            )
                          }
                          onChange={() =>
                            toggleArrayValue(
                              'availableSides',
                              side.value
                            )
                          }
                        />

                        <span>
                          {side.label}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>

              {/* TÉCNICAS */}

              <div className="col-12">
                <label className="form-label">
                  Técnicas permitidas
                </label>

                <div className="option-group">
                  {techniqueOptions.map(
                    (
                      technique
                    ) => (
                      <label
                        key={
                          technique
                        }
                        className="option-check"
                      >
                        <input
                          type="checkbox"
                          checked={
                            form.allowedTechniques.includes(
                              technique
                            )
                          }
                          onChange={() =>
                            toggleArrayValue(
                              'allowedTechniques',
                              technique
                            )
                          }
                        />

                        <span>
                          {technique}
                        </span>
                      </label>
                    )
                  )}
                </div>
              </div>
            </>
          )}

          {showFrontImage && (
            <div className="col-12 col-md-6">
              <label className="form-label">
                Imagen frontal
              </label>

              <input
                type="file"
                className="form-control"
                accept="image/png,image/jpeg,image/webp"
                onChange={
                  handleFrontImage
                }
              />

              <div className="form-text">
                {isEditing
                  ? 'Selecciona una nueva imagen únicamente si deseas reemplazar la actual.'
                  : 'PNG, JPG o WEBP. Máximo 5 MB.'}
              </div>

              {frontPreview && (
                <div className="mt-3">
                  <img
                    src={
                      frontPreview
                    }
                    alt="Vista previa frontal"
                    style={{
                      width:
                        '100%',

                      maxHeight:
                        '250px',

                      objectFit:
                        'contain',

                      borderRadius:
                        '8px'
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {showBackImage && (
            <div className="col-12 col-md-6">
              <label className="form-label">
                Imagen trasera
              </label>

              <input
                type="file"
                className="form-control"
                accept="image/png,image/jpeg,image/webp"
                onChange={
                  handleBackImage
                }
              />

              <div className="form-text">
                {isEditing
                  ? 'Opcional. Selecciona otra imagen si deseas reemplazar la actual.'
                  : 'PNG, JPG o WEBP. Máximo 5 MB.'}
              </div>

              {backPreview && (
                <div className="mt-3">
                  <img
                    src={
                      backPreview
                    }
                    alt="Vista previa trasera"
                    style={{
                      width:
                        '100%',

                      maxHeight:
                        '250px',

                      objectFit:
                        'contain',

                      borderRadius:
                        '8px'
                    }}
                  />
                </div>
              )}
            </div>
          )}

          {requiredSleeves.map(({ value, label }) => (
            <label key={value} className="col-12 col-md-6">
              Foto de {label.toLowerCase()}
              <input type="file" className="form-control" accept="image/png,image/jpeg,image/webp"
                required={!sleeveImages[value] && !sleeveFiles[value]}
                onChange={event => {
                  const file = event.target.files?.[0]
                  if (file && !validateImage(file)) {
                    event.target.value = ''
                    return
                  }
                  setSleeveFiles(previous => ({ ...previous, [value]: file }))
                }} />
              {sleeveImages[value] && <img className="img-thumbnail mt-2" width="160"
                src={sleeveImages[value]} alt={label} />}
            </label>
          ))}

        </div>

        <div className="d-flex justify-content-end gap-2 mt-4">

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() =>
              navigate(
                '/productos'
              )
            }
            disabled={
              loading
            }
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={
              loading
            }
          >
            {loading
              ? isEditing
                ? 'Actualizando...'
                : 'Subiendo imágenes...'
              : isEditing
                ? 'Actualizar producto'
                : 'Registrar producto'}
          </button>

        </div>
      </form>
    </div>
  )
}

export default CreateProductPage