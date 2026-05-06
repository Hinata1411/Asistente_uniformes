import {
  Stage,
  Layer,
  Image as KonvaImage,
  Transformer,
  Text
} from 'react-konva'
import { useEffect, useRef, useState } from 'react'

function useImage(src) {
  const [image, setImage] = useState(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
      return
    }

    const img = new window.Image()
    img.src = src
    img.onload = () => setImage(img)

    return () => {
      if (src.startsWith('blob:')) {
        URL.revokeObjectURL(src)
      }
    }
  }, [src])

  return image
}

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

  if (!image) return null

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
            y: e.target.y()
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
            height: Math.max(30, node.height() * scaleY)
          })
        }}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(oldBox, newBox) => {
            if (newBox.width < 30 || newBox.height < 30) return oldBox
            if (newBox.width > 350 || newBox.height > 350) return oldBox
            return newBox
          }}
        />
      )}
    </>
  )
}

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
            y: e.target.y()
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
            fontSize: Math.max(18, element.fontSize * scaleX)
          })
        }}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          enabledAnchors={[
            'top-left',
            'top-right',
            'bottom-left',
            'bottom-right'
          ]}
        />
      )}
    </>
  )
}

function GarmentEditor({
  product,
  customizationSide,
  onPreviewChange,
  onElementsChange,
  onSave
}) {
  const frontImage = useImage(product?.images?.frente)
  const backImage = useImage(product?.images?.espalda)

  const stageFrontRef = useRef(null)
  const stageBackRef = useRef(null)

  const [selectedId, setSelectedId] = useState(null)
  const [elements, setElements] = useState([])

  useEffect(() => {
    if (onElementsChange) {
      onElementsChange(elements)
    }
  }, [elements])

  const selectedElement = elements.find((el) => el.id === selectedId)

  const showFront =
    customizationSide === 'frente' || customizationSide === 'ambos'

  const showBack =
    customizationSide === 'espalda' || customizationSide === 'ambos'

  const updateElement = (newAttrs) => {
    setElements((prev) =>
      prev.map((el) => (el.id === newAttrs.id ? newAttrs : el))
    )
  }

  const updateSelectedElement = (changes) => {
    if (!selectedElement) return

    updateElement({
      ...selectedElement,
      ...changes
    })
  }

  const addImage = (src) => {
    const id = crypto.randomUUID()

    const newImage = {
      id,
      type: 'image',
      src,
      x: 180,
      y: 180,
      width: 120,
      height: 120
    }

    setElements((prev) => [...prev, newImage])
    setSelectedId(id)
  }

  const addText = () => {
    const id = crypto.randomUUID()

    const newText = {
      id,
      type: 'text',
      text: 'NUEVO TEXTO',
      x: 160,
      y: 120,
      fontSize: 42,
      color: '#ffffff',
      bold: true
    }

    setElements((prev) => [...prev, newText])
    setSelectedId(id)
  }

  const deleteSelected = () => {
    if (!selectedId) return

    setElements((prev) => prev.filter((el) => el.id !== selectedId))
    setSelectedId(null)
  }

  const clearSelection = () => {
    setSelectedId(null)
  }

  const handleUpload = (e) => {
    const file = e.target.files[0]
    if (!file) return

    const url = URL.createObjectURL(file)
    addImage(url)

    e.target.value = ''
  }

  const getStagePreview = (stageRef) => {
    if (!stageRef.current) return null

    return stageRef.current.toDataURL({
      pixelRatio: 2
    })
  }

  const mergePreviews = (frontPreview, backPreview) => {
    if (frontPreview && !backPreview) return frontPreview
    if (!frontPreview && backPreview) return backPreview
    if (!frontPreview && !backPreview) return null

    const mergedCanvas = document.createElement('canvas')
    mergedCanvas.width = 1000
    mergedCanvas.height = 600

    const ctx = mergedCanvas.getContext('2d')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, mergedCanvas.width, mergedCanvas.height)

    return new Promise((resolve) => {
      const frontImg = new window.Image()
      const backImg = new window.Image()

      let loaded = 0

      const draw = () => {
        loaded++

        if (loaded === 2) {
          ctx.drawImage(frontImg, 0, 0, 500, 600)
          ctx.drawImage(backImg, 500, 0, 500, 600)
          resolve(mergedCanvas.toDataURL('image/png'))
        }
      }

      frontImg.onload = draw
      backImg.onload = draw

      frontImg.src = frontPreview
      backImg.src = backPreview
    })
  }

  const generatePreview = async (clearSelected = false) => {
  if (clearSelected) {
    setSelectedId(null)
    await new Promise((resolve) => setTimeout(resolve, 80))
  }

    const frontPreview = showFront ? getStagePreview(stageFrontRef) : null
    const backPreview = showBack ? getStagePreview(stageBackRef) : null

    const preview =
      customizationSide === 'ambos'
        ? await mergePreviews(frontPreview, backPreview)
        : frontPreview || backPreview

    if (preview && onPreviewChange) {
      onPreviewChange(preview)
    }

    return preview
  }

  useEffect(() => {
    if (!product || !customizationSide) return

    const timer = setTimeout(() => {
      generatePreview(false)
    }, 300)

    return () => clearTimeout(timer)
  }, [product, customizationSide, elements])

  const handleSave = async () => {
    if (!product) {
      alert('Selecciona un producto del inventario')
      return
    }

    if (!customizationSide) {
      alert('Selecciona si será frente, espalda o ambos')
      return
    }

    const preview = await generatePreview(true)

    if (!preview) {
      alert('No se pudo generar la vista previa')
      return
    }

    if (onSave) {
      onSave({
        previewImage: preview,
        productId: product.id,
        productName: product.name,
        productType: product.type,
        productColor: product.color,
        customizationSide,
        elements,
        createdAt: new Date().toISOString()
      })
    }
  }

  const renderElements = () =>
    elements.map((element) => {
      if (element.type === 'image') {
        return (
          <ImageElement
            key={element.id}
            element={element}
            isSelected={element.id === selectedId}
            onSelect={() => setSelectedId(element.id)}
            onChange={updateElement}
          />
        )
      }

      return (
        <TextElement
          key={element.id}
          element={element}
          isSelected={element.id === selectedId}
          onSelect={() => setSelectedId(element.id)}
          onChange={updateElement}
        />
      )
    })

  return (
    <div className="card shadow-sm mt-4">
      <div className="card-header text-center">
        Vista previa del uniforme
      </div>

      <div className="card-body">
        {!product && (
          <div className="alert alert-info">
            Selecciona un producto del inventario para mostrar la vista previa.
          </div>
        )}

        {product && (
          <>
            <div className="mb-3 text-center">
              <strong>{product.name}</strong>
              <br />
              <small className="text-muted">
                Color: {product.color} | Stock: {product.stock}
              </small>
            </div>

            {!customizationSide && (
              <div className="alert alert-warning">
                Selecciona si la personalización será al frente, atrás o ambas.
              </div>
            )}

            <div className="card p-3 mb-3">
              <h6>Herramientas de personalización</h6>

              <div className="row g-2 align-items-end">
                <div className="col-md-5">
                  <label className="form-label">Subir logo o diseño</label>
                  <input
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={handleUpload}
                  />
                </div>

                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-dark w-100"
                    onClick={addText}
                    disabled={!customizationSide}
                  >
                    Agregar texto
                  </button>
                </div>

                <div className="col-md-3">
                  <button
                    type="button"
                    className="btn btn-outline-danger w-100"
                    onClick={deleteSelected}
                    disabled={!selectedId}
                  >
                    Eliminar seleccionado
                  </button>
                </div>

                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary w-100"
                    onClick={clearSelection}
                    disabled={!selectedId}
                  >
                    Deseleccionar
                  </button>
                </div>
              </div>
            </div>

            {selectedElement?.type === 'text' && (
              <div className="card p-3 mb-3 border">
                <h6>Editar texto seleccionado</h6>

                <div className="row g-2">
                  <div className="col-md-5">
                    <label className="form-label">Texto</label>
                    <input
                      type="text"
                      className="form-control"
                      value={selectedElement.text}
                      onChange={(e) =>
                        updateSelectedElement({
                          text: e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="col-md-2">
                    <label className="form-label">Color</label>
                    <input
                      type="color"
                      className="form-control form-control-color"
                      value={selectedElement.color}
                      onChange={(e) =>
                        updateSelectedElement({
                          color: e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">
                      Tamaño: {selectedElement.fontSize}px
                    </label>
                    <input
                      type="range"
                      className="form-range"
                      min="18"
                      max="110"
                      value={selectedElement.fontSize}
                      onChange={(e) =>
                        updateSelectedElement({
                          fontSize: Number(e.target.value)
                        })
                      }
                    />
                  </div>

                  <div className="col-md-2 d-flex align-items-end">
                    <button
                      type="button"
                      className={`btn w-100 ${
                        selectedElement.bold
                          ? 'btn-dark'
                          : 'btn-outline-dark'
                      }`}
                      onClick={() =>
                        updateSelectedElement({
                          bold: !selectedElement.bold
                        })
                      }
                    >
                      Negrita
                    </button>
                  </div>
                </div>
              </div>
            )}

            {selectedElement?.type === 'image' && (
              <div className="card p-3 mb-3 border">
                <h6>Imagen seleccionada</h6>
                <p className="mb-0 text-muted">
                  Puedes moverla, cambiar su tamaño desde las esquinas o eliminarla.
                </p>
              </div>
            )}

            <div className="d-flex gap-4 flex-wrap justify-content-center">
              {showFront && (
                <div>
                  <h5 className="text-center">Frente</h5>

                  <Stage
                    width={500}
                    height={600}
                    ref={stageFrontRef}
                    className="border bg-light"
                    onMouseDown={(e) => {
                      if (e.target === e.target.getStage()) {
                        clearSelection()
                      }
                    }}
                  >
                    <Layer>
                      {frontImage && (
                        <KonvaImage
                          image={frontImage}
                          x={50}
                          y={40}
                          width={400}
                          height={500}
                        />
                      )}

                      {renderElements()}
                    </Layer>
                  </Stage>
                </div>
              )}

              {showBack && (
                <div>
                  <h5 className="text-center">Espalda</h5>

                  <Stage
                    width={500}
                    height={600}
                    ref={stageBackRef}
                    className="border bg-light"
                    onMouseDown={(e) => {
                      if (e.target === e.target.getStage()) {
                        clearSelection()
                      }
                    }}
                  >
                    <Layer>
                      {backImage && (
                        <KonvaImage
                          image={backImage}
                          x={50}
                          y={40}
                          width={400}
                          height={500}
                        />
                      )}

                      {renderElements()}
                    </Layer>
                  </Stage>
                </div>
              )}
            </div>

            <div className="text-center mt-4">
              <button
                type="button"
                className="btn btn-outline-dark me-2"
                onClick={() => generatePreview(true)}
              >
                Actualizar vista previa IA
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={handleSave}
              >
                Guardar pedido
              </button>
            </div>
          </>
        )}
      </div>
    </div>
  )
}

export default GarmentEditor