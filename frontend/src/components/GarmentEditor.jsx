import { Stage, Layer, Image as KonvaImage } from 'react-konva'
import { useEffect, useState } from 'react'
import shirtWhite from '../assets/products/playera-negra.jpg'

function useImage(src) {
  const [image, setImage] = useState(null)

  useEffect(() => {
    const img = new window.Image()
    img.src = src
    img.onload = () => setImage(img)
  }, [src])

  return image
}

function GarmentEditor() {
  const shirtImage = useImage(shirtWhite)

  return (
    <div className="card shadow-sm">
      <div className="card-header">
        Vista previa de la prenda
      </div>

      <div className="card-body d-flex justify-content-center">
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
          </Layer>
        </Stage>
      </div>
    </div>
  )
}

export default GarmentEditor