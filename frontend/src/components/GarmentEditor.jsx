import {
  Stage,
  Layer,
  Image as KonvaImage,
  Transformer,
  Text
} from 'react-konva'

import {
  useEffect,
  useRef,
  useState
} from 'react'

import './GarmentEditor.css'

/* =========================================================
   CARGAR IMÁGENES
========================================================= */

function useImage(src) {
  const [image, setImage] = useState(null)

  useEffect(() => {
    if (!src) {
      setImage(null)
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
    if (
      src.startsWith('http://') ||
      src.startsWith('https://')
    ) {
      img.crossOrigin = 'anonymous'
    }

    img.onload = () => {
      if (!cancelled) {
        setImage(img)
      }
    }

    img.onerror = (error) => {
      if (!cancelled) {
        console.error(
          'Error cargando imagen en el editor:',
          src,
          error
        )

        setImage(null)
      }
    }

    img.src = src

    return () => {
      cancelled = true
    }
  }, [src])

  return image
}

/* =========================================================
   ELEMENTO IMAGEN
========================================================= */

function ImageElement({
  element,
  isSelected,
  onSelect,
  onChange
}) {
  const image = useImage(element.src)

  const shapeRef = useRef(null)
  const trRef = useRef(null)

  useEffect(() => {
    if (
      isSelected &&
      trRef.current &&
      shapeRef.current
    ) {
      trRef.current.nodes([
        shapeRef.current
      ])

      trRef.current
        .getLayer()
        .batchDraw()
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
            y: e.target.y()
          })
        }}
        onTransformEnd={() => {
          const node =
            shapeRef.current

          const scaleX =
            node.scaleX()

          const scaleY =
            node.scaleY()

          node.scaleX(1)
          node.scaleY(1)

          onChange({
            ...element,

            x:
              node.x(),

            y:
              node.y(),

            width:
              Math.max(
                30,
                node.width() *
                  scaleX
              ),

            height:
              Math.max(
                30,
                node.height() *
                  scaleY
              )
          })
        }}
      />

      {isSelected && (
        <Transformer
          ref={trRef}
          rotateEnabled={false}
          boundBoxFunc={(
            oldBox,
            newBox
          ) => {
            if (
              newBox.width < 30 ||
              newBox.height < 30
            ) {
              return oldBox
            }

            if (
              newBox.width > 350 ||
              newBox.height > 350
            ) {
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

function TextElement({
  element,
  isSelected,
  onSelect,
  onChange
}) {
  const textRef =
    useRef(null)

  const trRef =
    useRef(null)

  useEffect(() => {
    if (
      isSelected &&
      trRef.current &&
      textRef.current
    ) {
      trRef.current.nodes([
        textRef.current
      ])

      trRef.current
        .getLayer()
        .batchDraw()
    }
  }, [isSelected])

  return (
    <>
      <Text
        ref={textRef}
        text={element.text}
        x={element.x}
        y={element.y}
        fontSize={
          element.fontSize
        }
        fill={
          element.color
        }
        fontStyle={
          element.bold
            ? 'bold'
            : 'normal'
        }
        draggable
        onClick={onSelect}
        onTap={onSelect}
        onDragEnd={(e) => {
          onChange({
            ...element,

            x:
              e.target.x(),

            y:
              e.target.y()
          })
        }}
        onTransformEnd={() => {
          const node =
            textRef.current

          const scaleX =
            node.scaleX()

          node.scaleX(1)
          node.scaleY(1)

          onChange({
            ...element,

            x:
              node.x(),

            y:
              node.y(),

            fontSize:
              Math.max(
                18,
                element.fontSize *
                  scaleX
              )
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

/* =========================================================
   EDITOR PRINCIPAL
========================================================= */

function GarmentEditor({
  product,
  customerGarmentImage,
  customerGarment,
  customizationSide,
  onPreviewChange,
  onElementsChange,
  onSave
}) {
  /*
    El producto de inventario ya viene normalizado:

    images.frente
    images.espalda
  */

  const baseFrontImage =
    product?.images?.frente ||
    customerGarmentImage ||
    ''

  const baseBackImage =
    product?.images?.espalda ||
    customerGarmentImage ||
    ''

  const frontImage =
    useImage(
      baseFrontImage
    )

  const backImage =
    useImage(
      baseBackImage
    )

  const hasGarment =
    Boolean(
      product ||
      customerGarmentImage
    )

  const stageFrontRef =
    useRef(null)

  const stageBackRef =
    useRef(null)

  const [
    selectedId,
    setSelectedId
  ] = useState(null)

  const [
    elements,
    setElements
  ] = useState([])

  /* =======================================================
     COMUNICAR ELEMENTOS AL PADRE
  ======================================================= */

  useEffect(() => {
    if (onElementsChange) {
      onElementsChange(
        elements
      )
    }
  }, [
    elements,
    onElementsChange
  ])

  const selectedElement =
    elements.find(
      (element) =>
        element.id ===
        selectedId
    )

  const showFront =
    customizationSide ===
      'frente' ||
    customizationSide ===
      'ambos'

  const showBack =
    customizationSide ===
      'espalda' ||
    customizationSide ===
      'ambos'

  /* =======================================================
     ACTUALIZAR ELEMENTOS
  ======================================================= */

  const updateElement = (
    newAttrs
  ) => {
    setElements(
      (prev) =>
        prev.map(
          (element) =>
            element.id ===
            newAttrs.id
              ? newAttrs
              : element
        )
    )
  }

  const updateSelectedElement =
    (changes) => {
      if (
        !selectedElement
      ) {
        return
      }

      updateElement({
        ...selectedElement,
        ...changes
      })
    }

  /* =======================================================
     AGREGAR IMAGEN
  ======================================================= */

  const addImage = (
    src
  ) => {
    const id =
      crypto.randomUUID()

    const newImage = {
      id,

      type:
        'image',

      src,

      x:
        180,

      y:
        180,

      width:
        120,

      height:
        120
    }

    setElements(
      (prev) => [
        ...prev,
        newImage
      ]
    )

    setSelectedId(id)
  }

  /* =======================================================
     AGREGAR TEXTO
  ======================================================= */

  const addText = () => {
    const id =
      crypto.randomUUID()

    const newText = {
      id,

      type:
        'text',

      text:
        'NUEVO TEXTO',

      x:
        160,

      y:
        120,

      fontSize:
        42,

      color:
        '#ffffff',

      bold:
        true
    }

    setElements(
      (prev) => [
        ...prev,
        newText
      ]
    )

    setSelectedId(id)
  }

  /* =======================================================
     ELIMINAR
  ======================================================= */

  const deleteSelected =
    () => {
      if (!selectedId) {
        return
      }

      setElements(
        (prev) =>
          prev.filter(
            (element) =>
              element.id !==
              selectedId
          )
      )

      setSelectedId(null)
    }

  const clearSelection =
    () => {
      setSelectedId(null)
    }

  /* =======================================================
     SUBIR LOGO / DISEÑO LOCAL
  ======================================================= */

  const handleUpload = (
    e
  ) => {
    const file =
      e.target.files?.[0]

    if (!file) {
      return
    }

    if (
      !file.type.startsWith(
        'image/'
      )
    ) {
      alert(
        'Selecciona un archivo de imagen válido.'
      )

      e.target.value = ''
      return
    }

    const url =
      URL.createObjectURL(
        file
      )

    addImage(url)

    e.target.value = ''
  }

  /* =======================================================
     GENERAR DATA URL DEL STAGE
  ======================================================= */

  const getStagePreview = (
    stageRef
  ) => {
    if (
      !stageRef.current
    ) {
      return null
    }

    try {
      return (
        stageRef.current
          .toDataURL({
            pixelRatio:
              2
          })
      )
    } catch (error) {
      console.error(
        'Error generando vista previa del canvas:',
        error
      )

      return null
    }
  }

  /* =======================================================
     UNIR FRENTE + ESPALDA
  ======================================================= */

  const mergePreviews = (
    frontPreview,
    backPreview
  ) => {
    if (
      frontPreview &&
      !backPreview
    ) {
      return frontPreview
    }

    if (
      !frontPreview &&
      backPreview
    ) {
      return backPreview
    }

    if (
      !frontPreview &&
      !backPreview
    ) {
      return null
    }

    const mergedCanvas =
      document.createElement(
        'canvas'
      )

    mergedCanvas.width =
      1000

    mergedCanvas.height =
      600

    const ctx =
      mergedCanvas.getContext(
        '2d'
      )

    ctx.fillStyle =
      '#ffffff'

    ctx.fillRect(
      0,
      0,
      mergedCanvas.width,
      mergedCanvas.height
    )

    return new Promise(
      (
        resolve,
        reject
      ) => {
        const frontImg =
          new window.Image()

        const backImg =
          new window.Image()

        let loaded = 0

        const draw =
          () => {
            loaded++

            if (
              loaded === 2
            ) {
              try {
                ctx.drawImage(
                  frontImg,
                  0,
                  0,
                  500,
                  600
                )

                ctx.drawImage(
                  backImg,
                  500,
                  0,
                  500,
                  600
                )

                resolve(
                  mergedCanvas.toDataURL(
                    'image/png'
                  )
                )
              } catch (
                error
              ) {
                console.error(
                  'Error combinando vistas previas:',
                  error
                )

                reject(
                  error
                )
              }
            }
          }

        frontImg.onload =
          draw

        backImg.onload =
          draw

        frontImg.onerror =
          reject

        backImg.onerror =
          reject

        /*
          Estas vistas ya son data URLs
          generadas internamente.
        */

        frontImg.src =
          frontPreview

        backImg.src =
          backPreview
      }
    )
  }

  /* =======================================================
     GENERAR PREVIEW
  ======================================================= */

  const generatePreview =
    async (
      clearSelected =
        false
    ) => {
      try {
        if (
          clearSelected
        ) {
          setSelectedId(
            null
          )

          /*
            Esperar a que React quite
            el Transformer antes de
            exportar el canvas.
          */
          await new Promise(
            (resolve) =>
              setTimeout(
                resolve,
                100
              )
          )
        }

        const frontPreview =
          showFront
            ? getStagePreview(
                stageFrontRef
              )
            : null

        const backPreview =
          showBack
            ? getStagePreview(
                stageBackRef
              )
            : null

        let preview = null

        if (
          customizationSide ===
          'ambos'
        ) {
          if (
            !frontPreview ||
            !backPreview
          ) {
            console.error(
              'No se pudieron generar ambas vistas.'
            )

            return null
          }

          preview =
            await mergePreviews(
              frontPreview,
              backPreview
            )
        } else {
          preview =
            frontPreview ||
            backPreview
        }

        if (
          preview &&
          onPreviewChange
        ) {
          onPreviewChange(
            preview
          )
        }

        return preview
      } catch (error) {
        console.error(
          'Error generando vista previa:',
          error
        )

        return null
      }
    }

  /* =======================================================
     ACTUALIZACIÓN AUTOMÁTICA DE PREVIEW
  ======================================================= */

  useEffect(() => {
    if (
      !hasGarment ||
      !customizationSide
    ) {
      return
    }

    /*
      Esperamos a que la imagen base haya cargado.
    */

    if (
      showFront &&
      !frontImage
    ) {
      return
    }

    if (
      showBack &&
      !backImage
    ) {
      return
    }

    const timer =
      setTimeout(
        () => {
          generatePreview(
            false
          )
        },
        300
      )

    return () =>
      clearTimeout(
        timer
      )
  }, [
    product,
    customerGarmentImage,
    customizationSide,
    elements,
    frontImage,
    backImage
  ])

  /* =======================================================
     GUARDAR PEDIDO
  ======================================================= */

  const handleSave =
    async () => {
      if (!hasGarment) {
        alert(
          'Selecciona un producto o carga una fotografía de la prenda'
        )

        return
      }

      if (
        !customizationSide
      ) {
        alert(
          'Selecciona si será frente, espalda o ambos'
        )

        return
      }

      /*
        Comprobar que la imagen base
        haya terminado de cargar.
      */

      if (
        showFront &&
        !frontImage
      ) {
        alert(
          'La imagen frontal todavía no ha terminado de cargar.'
        )

        return
      }

      if (
        showBack &&
        !backImage
      ) {
        alert(
          'La imagen trasera todavía no ha terminado de cargar.'
        )

        return
      }

      const preview =
        await generatePreview(
          true
        )

      if (!preview) {
        alert(
          'No se pudo generar la vista previa'
        )

        return
      }

      if (onSave) {
        await onSave({
          previewImage:
            preview,

          productId:
            product?.id ||
            null,

          productName:
            product?.name ||
            customerGarment?.type ||
            'Prenda proporcionada por el cliente',

          productType:
            product?.type ||
            customerGarment?.type ||
            'otro',

          productColor:
            product?.color ||
            customerGarment?.color ||
            '',

          customizationSide,

          elements,

          createdAt:
            new Date()
              .toISOString()
        })
      }
    }

  /* =======================================================
     RENDER ELEMENTOS
  ======================================================= */

  const renderElements =
    () =>
      elements.map(
        (element) => {
          if (
            element.type ===
            'image'
          ) {
            return (
              <ImageElement
                key={
                  element.id
                }
                element={
                  element
                }
                isSelected={
                  element.id ===
                  selectedId
                }
                onSelect={() =>
                  setSelectedId(
                    element.id
                  )
                }
                onChange={
                  updateElement
                }
              />
            )
          }

          return (
            <TextElement
              key={
                element.id
              }
              element={
                element
              }
              isSelected={
                element.id ===
                selectedId
              }
              onSelect={() =>
                setSelectedId(
                  element.id
                )
              }
              onChange={
                updateElement
              }
            />
          )
        }
      )

  /* =========================================================
     UI
  ========================================================= */

  return (
    <div className="garment-editor">

      <div className="card-header text-center">
        Vista previa del uniforme
      </div>

      <div className="card-body">

        {!hasGarment && (
          <div className="alert alert-info">
            Selecciona un producto del inventario o carga una fotografía
            de la prenda proporcionada por el cliente.
          </div>
        )}

        {hasGarment && (
          <>

            <div className="mb-3 text-center">
              <strong>
                {product
                  ? product.name
                  : customerGarment?.type ||
                    'Prenda del cliente'}
              </strong>

              <br />

              <small className="text-muted">
                {product
                  ? `Color: ${product.color} | Stock: ${product.stock}`
                  : `Color: ${
                      customerGarment?.color ||
                      'No especificado'
                    } | Prenda proporcionada por el cliente`}
              </small>
            </div>

            {!customizationSide && (
              <div className="alert alert-warning">
                Selecciona si la personalización será al frente,
                atrás o ambas.
              </div>
            )}

            {/* HERRAMIENTAS */}

            <div className="card p-3 mb-3">
              <h6>
                Herramientas de personalización
              </h6>

              <div className="row g-2 align-items-end">

                <div className="col-md-5">
                  <label className="form-label">
                    Subir logo o diseño
                  </label>

                  <input
                    type="file"
                    accept="image/*"
                    className="form-control"
                    onChange={
                      handleUpload
                    }
                    disabled={
                      !customizationSide
                    }
                  />
                </div>

                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-dark w-100"
                    onClick={
                      addText
                    }
                    disabled={
                      !customizationSide
                    }
                  >
                    Agregar texto
                  </button>
                </div>

                <div className="col-md-3">
                  <button
                    type="button"
                    className="btn btn-outline-danger w-100"
                    onClick={
                      deleteSelected
                    }
                    disabled={
                      !selectedId
                    }
                  >
                    Eliminar seleccionado
                  </button>
                </div>

                <div className="col-md-2">
                  <button
                    type="button"
                    className="btn btn-outline-secondary w-100"
                    onClick={
                      clearSelection
                    }
                    disabled={
                      !selectedId
                    }
                  >
                    Deseleccionar
                  </button>
                </div>

              </div>
            </div>

            {/* EDITAR TEXTO */}

            {selectedElement?.type ===
              'text' && (
              <div className="card p-3 mb-3 border">

                <h6>
                  Editar texto seleccionado
                </h6>

                <div className="row g-2">

                  <div className="col-md-5">
                    <label className="form-label">
                      Texto
                    </label>

                    <input
                      type="text"
                      className="form-control"
                      value={
                        selectedElement.text
                      }
                      onChange={(e) =>
                        updateSelectedElement({
                          text:
                            e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="col-md-2">
                    <label className="form-label">
                      Color
                    </label>

                    <input
                      type="color"
                      className="form-control form-control-color"
                      value={
                        selectedElement.color
                      }
                      onChange={(e) =>
                        updateSelectedElement({
                          color:
                            e.target.value
                        })
                      }
                    />
                  </div>

                  <div className="col-md-3">
                    <label className="form-label">
                      Tamaño:{' '}
                      {
                        selectedElement.fontSize
                      }
                      px
                    </label>

                    <input
                      type="range"
                      className="form-range"
                      min="18"
                      max="110"
                      value={
                        selectedElement.fontSize
                      }
                      onChange={(e) =>
                        updateSelectedElement({
                          fontSize:
                            Number(
                              e.target.value
                            )
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
                          bold:
                            !selectedElement.bold
                        })
                      }
                    >
                      Negrita
                    </button>
                  </div>

                </div>
              </div>
            )}

            {/* IMAGEN SELECCIONADA */}

            {selectedElement?.type ===
              'image' && (
              <div className="card p-3 mb-3 border">

                <h6>
                  Imagen seleccionada
                </h6>

                <p className="mb-0 text-muted">
                  Puedes moverla, cambiar su tamaño desde las esquinas
                  o eliminarla.
                </p>

              </div>
            )}

            {/* CANVAS */}

            <div className="d-flex gap-4 flex-wrap justify-content-center">

              {showFront && (
                <div>

                  <h5 className="text-center">
                    Frente
                  </h5>

                  <Stage
                    width={500}
                    height={600}
                    ref={
                      stageFrontRef
                    }
                    className="border bg-light"
                    onMouseDown={(e) => {
                      if (
                        e.target ===
                        e.target.getStage()
                      ) {
                        clearSelection()
                      }
                    }}
                  >
                    <Layer>

                      {frontImage && (
                        <KonvaImage
                          image={
                            frontImage
                          }
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

                  <h5 className="text-center">
                    Espalda
                  </h5>

                  <Stage
                    width={500}
                    height={600}
                    ref={
                      stageBackRef
                    }
                    className="border bg-light"
                    onMouseDown={(e) => {
                      if (
                        e.target ===
                        e.target.getStage()
                      ) {
                        clearSelection()
                      }
                    }}
                  >
                    <Layer>

                      {backImage && (
                        <KonvaImage
                          image={
                            backImage
                          }
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

            {/* ACCIONES */}

            <div className="text-center mt-4">

              <button
                type="button"
                className="btn btn-outline-dark me-2"
                onClick={() =>
                  generatePreview(
                    true
                  )
                }
              >
                Actualizar vista previa IA
              </button>

              <button
                type="button"
                className="btn btn-success"
                onClick={
                  handleSave
                }
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