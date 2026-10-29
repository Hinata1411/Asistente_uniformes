import {
  ref,
  uploadString,
  getDownloadURL,
  deleteObject,
} from 'firebase/storage'
import { storage } from '../firebase/config'
export async function readImage(file) {
  if (
    !['image/png', 'image/jpeg', 'image/webp'].includes(file.type) ||
    file.size >= 5 * 1024 * 1024
  )
    throw new Error('Usa PNG, JPG o WEBP de menos de 5 MB.')
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(reader.result)
    reader.onerror = () => reject(new Error('No se pudo leer la imagen.'))
    reader.readAsDataURL(file)
  })
}
export async function persistImage(image, folder, uploaded) {
  if (!image || !image.startsWith('data:')) return image || ''
  const path = `${folder}/${crypto.randomUUID()}.png`
  const target = ref(storage, path)
  await uploadString(target, image, 'data_url')
  uploaded.push(path)
  return getDownloadURL(target)
}
export async function cleanUploads(paths) {
  await Promise.allSettled(
    paths.map((path) => deleteObject(ref(storage, path))),
  )
}
