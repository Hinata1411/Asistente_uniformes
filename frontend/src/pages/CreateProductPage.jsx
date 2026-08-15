import { useState } from 'react'
import { useNavigate } from 'react-router-dom'

import {
  ref,
  uploadBytes,
  getDownloadURL
} from 'firebase/storage'

import { storage } from '../firebase/config'
import { createProduct } from '../services/productsService'

import './CreateProductPage.css'

function CreateProductPage() {
  const navigate = useNavigate()

  const [form, setForm] = useState({
    name: '',
    type: '',
    color: '',
    stock: 0,
    sizes: [],
    availableSides: [],
    allowedTechniques: []
  })

  const [frontImageFile, setFrontImageFile] =
    useState(null)

  const [backImageFile, setBackImageFile] =
    useState(null)

  const [frontPreview, setFrontPreview] =
    useState('')

  const [backPreview, setBackPreview] =
    useState('')

  const [loading, setLoading] =
    useState(false)

  const sizeOptions = [
    'S',
    'M',
    'L',
    'XL'
  ]

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
    }
  ]

  const techniqueOptions = [
    'DTF',
    'Bordado',
    'Sublimación',
    'Vinil textil'
  ]

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

        [field]: exists
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

  const validateImage = (file) => {
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
      alert(
        'La imagen debe ser PNG, JPG, JPEG o WEBP.'
      )

      return false
    }

    const maxSize =
      5 * 1024 * 1024

    if (file.size > maxSize) {
      alert(
        'La imagen no puede superar los 5 MB.'
      )

      return false
    }

    return true
  }

  const handleFrontImage = (e) => {
    const file =
      e.target.files?.[0]

    if (!file) {
      return
    }

    if (!validateImage(file)) {
      e.target.value = ''
      return
    }

    setFrontImageFile(file)

    setFrontPreview(
      URL.createObjectURL(file)
    )
  }

  const handleBackImage = (e) => {
    const file =
      e.target.files?.[0]

    if (!file) {
      return
    }

    if (!validateImage(file)) {
      e.target.value = ''
      return
    }

    setBackImageFile(file)

    setBackPreview(
      URL.createObjectURL(file)
    )
  }

  const uploadProductImage =
    async (
      file,
      side
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

      const downloadURL =
        await getDownloadURL(
          imageRef
        )

      return downloadURL
    }

  const handleSubmit = async (e) => {
    e.preventDefault()

    if (
      !form.name ||
      !form.type ||
      !form.color ||
      form.stock < 0 ||
      form.sizes.length === 0 ||
      form.availableSides.length === 0 ||
      form.allowedTechniques.length === 0
    ) {
      alert(
        'Completa todos los campos obligatorios'
      )

      return
    }

    if (!frontImageFile) {
      alert(
        'Selecciona la imagen frontal del producto'
      )

      return
    }

    try {
      setLoading(true)

      const frontImageUrl =
        await uploadProductImage(
          frontImageFile,
          'front'
        )

      const backImageUrl =
        backImageFile
          ? await uploadProductImage(
              backImageFile,
              'back'
            )
          : ''

      await createProduct({
        name:
          form.name.trim(),

        type:
          form.type,

        color:
          form.color.trim(),

        stock:
          Number(form.stock),

        sizes:
          form.sizes,

        availableSides:
          form.availableSides,

        allowedTechniques:
          form.allowedTechniques,

        images: {
          frente:
            frontImageUrl,

          espalda:
            backImageUrl
        },

        frontImage:
          frontImageUrl,

        backImage:
          backImageUrl
      })

      alert(
        'Producto registrado correctamente'
      )

      navigate('/productos')
    } catch (error) {
      console.error(
        'Error creando producto:',
        error
      )

      alert(
        `No se pudo registrar el producto: ${error.message}`
      )
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="create-product-page">

      <div className="mb-4">
        <h2 className="page-title">
          Nuevo producto
        </h2>

        <p className="page-subtitle">
          Registra una nueva prenda disponible para personalización.
        </p>
      </div>

      <form
        className="app-card p-4"
        onSubmit={handleSubmit}
      >
        <div className="row g-3">

          {/* NOMBRE */}

          <div className="col-12 col-md-6">
            <label className="form-label">
              Nombre del producto
            </label>

            <input
              type="text"
              className="form-control"
              value={form.name}
              onChange={(e) =>
                setForm({
                  ...form,
                  name:
                    e.target.value
                })
              }
              placeholder="Ej. Jersey Enduro Pro"
              required
            />
          </div>

          {/* TIPO */}

          <div className="col-12 col-md-3">
            <label className="form-label">
              Tipo
            </label>

            <select
              className="form-select"
              value={form.type}
              onChange={(e) =>
                setForm({
                  ...form,
                  type:
                    e.target.value
                })
              }
              required
            >
              <option value="">
                Seleccione
              </option>

              <option value="playera">
                Playera
              </option>

              <option value="polo">
                Playera Polo
              </option>

              <option value="camisa_columbia">
                Camisa Columbia
              </option>

              <option value="jersey">
                Jersey
              </option>

              <option value="uniforme_futbol">
                Uniforme de fútbol
              </option>

              <option value="pantalon">
                Pantalón
              </option>

              <option value="short">
                Short
              </option>

              <option value="kit">
                Kit / Conjunto
              </option>

              <option value="otro">
                Otro
              </option>
            </select>
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
              value={form.stock}
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

          {/* COLOR */}

          <div className="col-12 col-md-4">
            <label className="form-label">
              Color
            </label>

            <input
              type="text"
              className="form-control"
              value={form.color}
              onChange={(e) =>
                setForm({
                  ...form,
                  color:
                    e.target.value
                })
              }
              placeholder="Ej. Negro"
              required
            />
          </div>

          {/* TALLAS */}

          <div className="col-12 col-md-8">
            <label className="form-label">
              Tallas disponibles
            </label>

            <div className="option-group">
              {sizeOptions.map(
                (size) => (
                  <label
                    key={size}
                    className="option-check"
                  >
                    <input
                      type="checkbox"
                      checked={
                        form.sizes.includes(
                          size
                        )
                      }
                      onChange={() =>
                        toggleArrayValue(
                          'sizes',
                          size
                        )
                      }
                    />

                    <span>
                      {size}
                    </span>
                  </label>
                )
              )}
            </div>
          </div>

          {/* ÁREAS */}

          <div className="col-12">
            <label className="form-label">
              Áreas disponibles para personalización
            </label>

            <div className="option-group">
              {sideOptions.map(
                (side) => (
                  <label
                    key={side.value}
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
                (technique) => (
                  <label
                    key={technique}
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

          {/* IMAGEN FRONTAL */}

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
              PNG, JPG o WEBP. Máximo 5 MB.
            </div>

            {frontPreview && (
              <div className="mt-3">
                <img
                  src={frontPreview}
                  alt="Vista previa frontal"
                  style={{
                    width: '100%',
                    maxHeight: '250px',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              </div>
            )}
          </div>

          {/* IMAGEN TRASERA */}

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
              Opcional. PNG, JPG o WEBP. Máximo 5 MB.
            </div>

            {backPreview && (
              <div className="mt-3">
                <img
                  src={backPreview}
                  alt="Vista previa trasera"
                  style={{
                    width: '100%',
                    maxHeight: '250px',
                    objectFit: 'contain',
                    borderRadius: '8px'
                  }}
                />
              </div>
            )}
          </div>

        </div>

        <div className="d-flex justify-content-end gap-2 mt-4">

          <button
            type="button"
            className="btn btn-outline-secondary"
            onClick={() =>
              navigate('/productos')
            }
            disabled={loading}
          >
            Cancelar
          </button>

          <button
            type="submit"
            className="btn btn-primary"
            disabled={loading}
          >
            {loading
              ? 'Subiendo imágenes...'
              : 'Registrar producto'}
          </button>

        </div>
      </form>
    </div>
  )
}

export default CreateProductPage