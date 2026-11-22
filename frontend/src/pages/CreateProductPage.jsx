import { useEffect, useState } from 'react'
import { useNavigate, useParams } from 'react-router-dom'
import { doc, getDoc, setDoc, collection, updateDoc } from 'firebase/firestore'
import { db } from '../firebase/config'
import { notify } from '../services/toastStore'
import {
  AREA_OPTIONS,
  AREA_LABELS,
  areaKeys,
  categoryOf,
  validAmount,
  money,
} from '../services/businessModel'
import { readImage, persistImage, cleanUploads } from '../services/imageFiles'
import '../styles/BusinessPages.css'

const empty = {
  category: 'prenda',
  name: '',
  type: '',
  color: '',
  stock: 0,
  price: '',
  size: '',
  availableSides: [],
  allowedTechniques: [],
  images: {},
}
export default function CreateProductPage() {
  const { id } = useParams()
  const navigate = useNavigate()
  const [form, setForm] = useState(empty),
    [loading, setLoading] = useState(Boolean(id)),
    [busy, setBusy] = useState(false),
    [error, setError] = useState('')
  useEffect(() => {
    if (!id) return
    let active = true
    getDoc(doc(db, 'products', id))
      .then((snap) => {
        if (!snap.exists()) throw new Error('El producto no existe.')
        const data = snap.data()
        if (active)
          setForm({
            ...empty,
            ...data,
            category: categoryOf(data),
            size: data.size || data.sizes?.[0] || '',
            legacyMultiSize: !data.size && data.sizes?.length > 1,
            images: {
              ...data.images,
              frente: data.images?.frente || data.frontImage || '',
              espalda: data.images?.espalda || data.backImage || '',
            },
          })
      })
      .catch((err) => {
        if (active) setError(err.message)
      })
      .finally(() => {
        if (active) setLoading(false)
      })
    return () => {
      active = false
    }
  }, [id])
  const set = (key, value) => setForm((prev) => ({ ...prev, [key]: value }))
  const garment = form.category === 'prenda'
  const requiredAreas = garment
    ? [...new Set(form.availableSides.flatMap(areaKeys))]
    : ['frente']
  const imageAreas = [...new Set(['frente', ...requiredAreas])]
  const toggle = (key, value) =>
    setForm((prev) => ({
      ...prev,
      [key]: prev[key].includes(value)
        ? prev[key].filter((v) => v !== value)
        : [...prev[key], value],
    }))
  const save = async (e) => {
    e.preventDefault()
    if (busy) return
    const uploaded = []
    try {
      if (form.legacyMultiSize)
        throw new Error(
          'Separa este producto antiguo en registros individuales con la talla y stock reales antes de usarlo.',
        )
      if (
        !form.name.trim() ||
        !form.type.trim() ||
        !Number.isInteger(Number(form.stock)) ||
        Number(form.stock) < 0 ||
        !validAmount(form.price)
      )
        throw new Error(
          'Completa nombre, tipo, precio válido y stock entero no negativo.',
        )
      if (
        garment &&
        (!form.size.trim() ||
          !form.color.trim() ||
          !requiredAreas.length ||
          !form.allowedTechniques.length)
      )
        throw new Error('Completa talla, color, áreas y técnicas de la prenda.')
      if (imageAreas.some((area) => !form.images[area]))
        throw new Error(
          'Carga una fotografía para cada área habilitada y la imagen principal.',
        )
      setBusy(true)
      const images = {}
      for (const area of imageAreas)
        images[area] = await persistImage(
          form.images[area],
          'products',
          uploaded,
        )
      const data = {
        category: form.category,
        name: form.name.trim(),
        type: form.type.trim(),
        color: form.color.trim(),
        stock: Number(form.stock),
        price: money(form.price),
        size: garment ? form.size.trim() : '',
        sizes: garment ? [form.size.trim()] : [],
        availableSides: garment ? form.availableSides : [],
        allowedTechniques: garment ? form.allowedTechniques : [],
        images,
        frontImage: images.frente || '',
        backImage: images.espalda || '',
        updatedAt: new Date().toISOString(),
      }
      if (id) await updateDoc(doc(db, 'products', id), data)
      else
        await setDoc(doc(collection(db, 'products')), {
          ...data,
          active: true,
          createdAt: new Date().toISOString(),
        })
      notify(id ? 'Producto actualizado' : 'Producto registrado', 'success')
      navigate('/productos')
    } catch (err) {
      await cleanUploads(uploaded)
      notify(err.message, 'error')
    } finally {
      setBusy(false)
    }
  }
  if (loading) return <p>Cargando producto...</p>
  if (error)
    return (
      <div role="alert" className="alert alert-danger">
        {error}
      </div>
    )
  return (
    <div className="business-page">
      <h2>{id ? 'Editar producto' : 'Nuevo producto'}</h2>
      <form className="order-section" onSubmit={save}>
        <fieldset disabled={busy}>
          {form.legacyMultiSize && (
            <div className="alert alert-warning">
              Este registro antiguo comparte stock entre varias tallas. Crea un
              registro nuevo por talla y desactiva el antiguo.
            </div>
          )}
          <div className="row g-3">
            <label className="col-md-6">
              Categoría
              <select
                className="form-select"
                value={form.category}
                disabled={Boolean(id)}
                onChange={(e) => set('category', e.target.value)}
              >
                <option value="prenda">Prenda</option>
                <option value="producto">Producto</option>
              </select>
            </label>
            <Input
              label="Nombre"
              value={form.name}
              onChange={(v) => set('name', v)}
              required
            />
            <Input
              label="Tipo"
              value={form.type}
              onChange={(v) => set('type', v)}
              required
            />
            <Input
              label="Color"
              value={form.color}
              onChange={(v) => set('color', v)}
              required={garment}
            />
            <Input
              label="Stock"
              type="number"
              min="0"
              step="1"
              value={form.stock}
              onChange={(v) => set('stock', v)}
              required
            />
            <Input
              label="Precio de referencia (Q)"
              type="number"
              min="0"
              step="0.01"
              value={form.price}
              onChange={(v) => set('price', v)}
              required
            />
            {garment && (
              <Input
                label="Talla manual"
                value={form.size}
                onChange={(v) => set('size', v)}
                maxLength="50"
                required
              />
            )}
          </div>
          <p className="form-text">
            El precio de cada pedido se ingresa manualmente al cotizar.
          </p>
          {garment && (
            <>
              <h5>Áreas disponibles para personalización</h5>
              <div className="d-flex flex-wrap gap-3">
                {AREA_OPTIONS.map(([value, label]) => (
                  <label key={value}>
                    <input
                      type="checkbox"
                      checked={form.availableSides.includes(value)}
                      onChange={() => toggle('availableSides', value)}
                    />{' '}
                    {label}
                  </label>
                ))}
              </div>
              <h5 className="mt-3">Técnicas permitidas</h5>
              <div className="d-flex flex-wrap gap-3">
                {['DTF', 'Bordado', 'Sublimación', 'Vinil textil'].map((t) => (
                  <label key={t}>
                    <input
                      type="checkbox"
                      checked={form.allowedTechniques.includes(t)}
                      onChange={() => toggle('allowedTechniques', t)}
                    />{' '}
                    {t}
                  </label>
                ))}
              </div>
            </>
          )}
          <h5 className="mt-4">Fotografías</h5>
          <div className="row g-3">
            {imageAreas.map((area) => (
              <label key={area} className="col-md-6">
                {area === 'frente' && !garment
                  ? 'Imagen del producto'
                  : AREA_LABELS[area]}
                <input
                  type="file"
                  className="form-control"
                  accept="image/jpeg,image/png,image/webp"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const image = await readImage(file)
                      setForm((prev) => ({
                        ...prev,
                        images: { ...prev.images, [area]: image },
                      }))
                    } catch (err) {
                      notify(err.message, 'error')
                    }
                    e.target.value = ''
                  }}
                />
                {form.images[area] && (
                  <img
                    className="reference-thumb"
                    src={form.images[area]}
                    alt={AREA_LABELS[area]}
                  />
                )}
              </label>
            ))}
          </div>
          <p className="form-text">
            PNG, JPG o WEBP, menos de 5 MB por fotografía. Las mangas requieren
            su propia fotografía.
          </p>
          <div className="d-flex gap-2 mt-4">
            <button className="btn btn-warning" type="submit">
              {busy
                ? 'Guardando...'
                : id
                  ? 'Guardar cambios'
                  : 'Registrar producto'}
            </button>
            <button
              type="button"
              className="btn btn-outline-secondary"
              onClick={() => navigate('/productos')}
            >
              Cancelar
            </button>
          </div>
        </fieldset>
      </form>
    </div>
  )
}
function Input({ label, onChange, ...props }) {
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
