import { Stage, Layer, Image as KonvaImage } from 'react-konva'
import { useEffect, useState } from 'react'
import shirtWhite from '../assets/products/playera-negra.jpg'

function useImage(src) {
  const [image, setImage] = useState(null)

  useEffect(() => {
    if (!src) return

    const img = new window.Image()
    img.src = src
    img.onload = () => setImage(img)
  }, [src])

  return image
}

function GarmentEditor() {
  const shirtImage = useImage(shirtWhite)

  const [logoSrc, setLogoSrc] = useState(null)
  const logoImage = useImage(logoSrc)

  const [logoPosition, setLogoPosition] = useState({
    x: 190,
    y: 180,
  })

  const handleLogoUpload = (e) => {
    const file = e.target.files[0]

    if (!file) return

    const imageUrl = URL.createObjectURL(file)
    setLogoSrc(imageUrl)
  }

  return (
    <div className="card shadow-sm">
      <div className="card-header">
        Vista previa de la prenda
      </div>

      <div className="card-body">
        <div className="mb-3">
          <label className="form-label">Subir logo o diseño</label>
          <input
            type="file"
            className="form-control"
            accept="image/*"
            onChange={handleLogoUpload}
          />
        </div>

        <div className="d-flex justify-content-center">
          <Stage width={500} height={600}>
            <Layer>
              {shirtImage && (
                <KonvaImage
                  image={shirtImage}
                  x={50}
                  y={40}
                  width={400}
                  height={500}
                />
              )}

              {logoImage && (
                <KonvaImage
                  image={logoImage}
                  x={logoPosition.x}
                  y={logoPosition.y}
                  width={120}
                  height={120}
                  draggable
                  onDragEnd={(e) => {
                    setLogoPosition({
                      x: e.target.x(),
                      y: e.target.y(),
                    })
                  }}
                />
              )}
            </Layer>
          </Stage>
        </div>
      </div>
    </div>
  )
}

export default GarmentEditor