import { areaKeys, AREA_LABELS, imageKey } from '../services/businessModel'
import { readImage } from '../services/imageFiles'
import {
  Stage,
  Layer,
  Image as KonvaImage,
  Transformer,
  Text,
} from 'react-konva'

import {
  useEffect,
  useRef,
  useState,
  forwardRef,
  useImperativeHandle,
} from 'react'

import { notify } from '../services/toastStore'
import '../styles/GarmentEditor.css'

/* =========================================================
   CARGAR IMÁGENES
========================================================= */

function useImage(src) {
  const [loaded, setImage] = useState(null)

  useEffect(() => {
    if (!src) {
      return
    }

    let cancelled = false

    const img = new window.Image()

    /*
      IMPORTANTE:
      Las imágenes provenientes de Firebase Storage
      deben cargarse con crossOrigin antes de asignar src.

      Esto evita que Konva contamine el canvas y permite
      utilizar stage.toDataURL().
    */
    if (src.startsWith('http://') || src.startsWith('https://')) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      if (!cancelled) {
        setImage({ src, image: img })
      }
    }

    img.onerror = (error) => {
      if (!cancelled) {
        console.error('Error cargando imagen en el editor:', error)

        setImage(null)
      }
    }

    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return src && loaded?.src === src ? loaded.image : null
}

/* =========================================================
   ELEMENTO IMAGEN
========================================================= */

function ImageElement({ element, isSelected, onSelect, onChange }) {
  const image = useImage(element.src)

  const shapeRef = useRef(null)
  const trRef = useRef(null)

  useEffect(() => {
    if (isSelected && trRef.current && shapeRef.current) {
      trRef.current.nodes([shapeRef.current])

      trRef.current.getLayer().batchDraw()
    }
  }, [isSelected])

  if (!image) {
    return null
  }

  return (
    <>
      <KonvaImage
        ref={shapeRef}
        image={image}
        x={element.x}
        y={element.y}
        width={element.width}
        height={element.height}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...element,
            x: e.target.x(),
            y: e.target.y(),
          })
        }}
        onTransformEnd={() => {
          const node = shapeRef.current

          const scaleX = node.scaleX()

          const scaleY = node.scaleY()

          node.scaleX(1)
          node.scaleY(1)

          onChange({
            ...element,

            x: node.x(),

            y: node.y(),

            width: Math.max(30, node.width() * scaleX),

            height: Math.max(30, node.height() * scaleY),
          })
        }}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
          ]}
          anchorSize={20}
          anchorCornerRadius={10}
          anchorFill="#ffffff"
          anchorStroke="#ffc603"
          anchorStrokeWidth={2.5}
          borderStroke="#ffc603"
          borderStrokeWidth={2}
          borderDash={[6, 3]}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 25 || newBox.height < 25) {
              return oldBox
            }

            if (newBox.width > 420 || newBox.height > 420) {
              return oldBox
            }

            return newBox
          }}
        />
      )}
    </>
  )
}

/* =========================================================
   ELEMENTO TEXTO
========================================================= */

function TextElement({ element, isSelected, onSelect, onChange }) {
  const textRef = useRef(null)

  const trRef = useRef(null)

  useEffect(() => {
    if (isSelected && trRef.current && textRef.current) {
      trRef.current.nodes([textRef.current])

      trRef.current.getLayer().batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <Text
        ref={textRef}
        text={element.text}
        x={element.x}
        y={element.y}
        fontSize={element.fontSize}
        fill={element.color}
        fontStyle={element.bold ? 'bold' : 'normal'}
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...element,

            x: e.target.x(),

            y: e.target.y(),
          })
        }}
        onTransformEnd={() => {
          const node = textRef.current

          const scaleX = node.scaleX()

          node.scaleX(1)
          node.scaleY(1)

          onChange({
            ...element,

            x: node.x(),

            y: node.y(),

            fontSize: Math.max(18, element.fontSize * scaleX),
          })
        }}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          keepRatio
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right',
          ]}
          anchorSize={20}
          anchorCornerRadius={10}
          anchorFill="#ffffff"
          anchorStroke="#ffc603"
          anchorStrokeWidth={2.5}
          borderStroke="#ffc603"
          borderStrokeWidth={2}
          borderDash={[6, 3]}
        />
      )}
    </>
  )
}

/* =========================================================
   EDITOR PRINCIPAL
========================================================= */

function AreaCanvas({
  area,
  src,
  elements,
  selectedId,
  onSelect,
  onChange,
  register,
}) {
  const image = useImage(src)
  return (
    <div className="card p-3" style={{ maxWidth: '100%', minWidth: 0 }}>
      <h5>{AREA_LABELS[area]}</h5>
      {!src && (
        <p className="text-danger">
          Falta la fotografía de {AREA_LABELS[area].toLowerCase()}.
        </p>
      )}
      {src && !image && <p>Cargando fotografía...</p>}
      <div style={{ overflowX: 'auto' }}>
        <Stage
          width={450}
          height={540}
          ref={(stage) => register(area, image ? stage : null)}
          onMouseDown={(e) => {
            if (e.target === e.target.getStage()) onSelect(null)
          }}
        >
          <Layer>
            {image && (
              <KonvaImage image={image} x={0} y={0} width={450} height={540} />
            )}
            {elements
              .filter((e) => !e.side || e.side === area)
              .map((e) =>
                e.type === 'text' ? (
                  <TextElement
                    key={e.id}
                    element={e}
                    isSelected={selectedId === e.id}
                    onSelect={() => onSelect(e.id)}
                    onChange={onChange}
                  />
                ) : (
                  <ImageElement
                    key={e.id}
                    element={e}
                    isSelected={selectedId === e.id}
                    onSelect={() => onSelect(e.id)}
                    onChange={onChange}
                  />
                ),
              )}
          </Layer>
        </Stage>
      </div>
    </div>
  )
}
const GarmentEditor = forwardRef(function GarmentEditor(
  {
    product,
    customerGarmentImage,
    customerGarmentImages,
    customizationSide,
    initialElements,
    onElementsChange,
    onSave,
  },
  ref,
) {
  const [elements, setElements] = useState(() => initialElements || [])
  const [selectedId, setSelectedId] = useState(null)
  const [target, setTarget] = useState('')
  const stages = useRef({})
  const callbacks = useRef({ onElementsChange, onSave })
  useEffect(() => {
    callbacks.current = { onElementsChange, onSave }
  }, [onElementsChange, onSave])
  const sides = areaKeys(customizationSide)
  const selected = elements.find((e) => e.id === selectedId)
  const activeSide = sides.includes(target) ? target : sides[0]
  useEffect(() => {
    callbacks.current.onElementsChange?.(elements)
  }, [elements])
  const change = (updated) =>
    setElements((prev) => prev.map((e) => (e.id === updated.id ? updated : e)))
  const add = (attrs) => {
    if (elements.length >= 50) {
      notify('Puedes agregar hasta 50 elementos por pedido.', 'warning')
      return
    }
    const id = crypto.randomUUID()
    setElements((prev) => [
      ...prev,
      { id, side: activeSide, x: 150, y: 140, ...attrs },
    ])
    setSelectedId(id)
  }
  const generatePreview = async () => {
    if (!sides.length) throw new Error('Selecciona el área de personalización.')
    const captures = sides.map((area) => {
      const stage = stages.current[area]
      if (!stage)
        throw new Error(`Carga y espera la fotografía de ${AREA_LABELS[area]}.`)
      const transformers = stage.find('Transformer')
      transformers.forEach((t) => t.hide())
      let data
      try {
        data = stage.toDataURL({ pixelRatio: 1.5 })
      } finally {
        transformers.forEach((t) => t.show())
      }
      return new Promise((resolve, reject) => {
        const img = new Image()
        img.onload = () => resolve({ area, img })
        img.onerror = () =>
          reject(new Error('No se pudo generar la vista previa.'))
        img.src = data
      })
    })
    const images = await Promise.all(captures)
    const canvas = document.createElement('canvas')
    canvas.width = 675 * images.length
    canvas.height = 850
    const ctx = canvas.getContext('2d')
    ctx.fillStyle = '#fff'
    ctx.fillRect(0, 0, canvas.width, canvas.height)
    images.forEach(({ area, img }, i) => {
      ctx.fillStyle = '#111'
      ctx.font = 'bold 22px Arial'
      ctx.fillText(AREA_LABELS[area], i * 675 + 20, 28)
      ctx.drawImage(img, i * 675, 40, 675, 810)
    })
    return canvas.toDataURL('image/png')
  }
  useImperativeHandle(ref, () => ({
    generatePreview,
    triggerSave: async () => {
      try {
        await callbacks.current.onSave?.({
          previewImage: await generatePreview(),
          elements,
        })
      } catch (error) {
        notify(error.message, 'error')
      }
    },
  }))
  return (
    <div className="garment-editor">
      {!sides.length ? (
        <p>Selecciona el área de personalización para abrir el editor.</p>
      ) : (
        <>
          <div className="card p-3 mb-3">
            <h6>Herramientas de personalización</h6>
            <label className="form-label">
              Área donde se agrega el elemento
              <select
                className="form-select"
                value={activeSide}
                onChange={(e) => {
                  setTarget(e.target.value)
                  setSelectedId(null)
                }}
              >
                {sides.map((s) => (
                  <option key={s} value={s}>
                    {AREA_LABELS[s]}
                  </option>
                ))}
              </select>
            </label>
            <div className="d-flex gap-2 flex-wrap">
              <label>
                Subir logo o diseño
                <input
                  aria-label="Subir logo o diseño"
                  type="file"
                  accept="image/png,image/jpeg,image/webp"
                  className="form-control"
                  onChange={async (e) => {
                    const file = e.target.files?.[0]
                    if (!file) return
                    try {
                      const src = await readImage(file)
                      const image = await new Promise((resolve, reject) => {
                        const img = new Image()
                        img.onload = () => resolve(img)
                        img.onerror = () =>
                          reject(new Error('No se pudo cargar el diseño.'))
                        img.src = src
                      })
                      const scale = Math.min(
                        120 / image.width,
                        120 / image.height,
                      )
                      add({
                        type: 'image',
                        src,
                        width: image.width * scale,
                        height: image.height * scale,
                      })
                    } catch (err) {
                      notify(err.message, 'error')
                    }
                    e.target.value = ''
                  }}
                />
              </label>
              <button
                type="button"
                className="btn btn-dark"
                onClick={() =>
                  add({
                    type: 'text',
                    text: 'NUEVO TEXTO',
                    fontSize: 32,
                    color: '#ffffff',
                    bold: true,
                  })
                }
              >
                Agregar texto
              </button>
              <button
                type="button"
                className="btn btn-outline-danger"
                disabled={!selected}
                onClick={() => {
                  setElements((prev) => prev.filter((e) => e.id !== selectedId))
                  setSelectedId(null)
                }}
              >
                Eliminar seleccionado
              </button>
              <button
                type="button"
                className="btn btn-outline-secondary"
                onClick={() => setSelectedId(null)}
              >
                Deseleccionar
              </button>
            </div>
            {selected?.type === 'text' && (
              <div className="row g-2 mt-2">
                <label className="col">
                  Texto
                  <input
                    className="form-control"
                    value={selected.text}
                    maxLength={300}
                    onChange={(e) =>
                      change({ ...selected, text: e.target.value })
                    }
                  />
                </label>
                <label className="col">
                  Color
                  <input
                    aria-label="Color del texto"
                    type="color"
                    className="form-control"
                    value={selected.color}
                    onChange={(e) =>
                      change({ ...selected, color: e.target.value })
                    }
                  />
                </label>
                <label className="col">
                  Tamaño
                  <input
                    type="number"
                    min="8"
                    max="180"
                    className="form-control"
                    value={selected.fontSize}
                    onChange={(e) =>
                      change({
                        ...selected,
                        fontSize: Math.max(
                          8,
                          Math.min(180, Number(e.target.value)),
                        ),
                      })
                    }
                  />
                </label>
                <button
                  type="button"
                  className="btn btn-dark col"
                  onClick={() => change({ ...selected, bold: !selected.bold })}
                >
                  Negrita
                </button>
              </div>
            )}
            {selected?.type === 'image' && (
              <div className="d-flex gap-2 mt-2">
                {[0.8, 1.2].map((f) => (
                  <button
                    type="button"
                    key={f}
                    className="btn btn-outline-dark"
                    onClick={() =>
                      change({
                        ...selected,
                        width: Math.max(25, Math.min(420, selected.width * f)),
                        height: Math.max(
                          25,
                          Math.min(520, selected.height * f),
                        ),
                      })
                    }
                  >
                    {f < 1 ? 'Reducir imagen' : 'Ampliar imagen'}
                  </button>
                ))}
              </div>
            )}
          </div>
          <div className="d-flex flex-wrap gap-3">
            {sides.map((area) => (
              <AreaCanvas
                key={area}
                area={area}
                src={
                  product?.images?.[area] ||
                  customerGarmentImages?.[imageKey(area)] ||
                  (area === 'frente' ? customerGarmentImage : '')
                }
                elements={elements}
                selectedId={selectedId}
                onSelect={setSelectedId}
                onChange={change}
                register={(a, stage) => {
                  stages.current[a] = stage
                }}
              />
            ))}
          </div>
        </>
      )}
    </div>
  )
})
export default GarmentEditor
