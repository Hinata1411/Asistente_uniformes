import { collection, doc, runTransaction } from 'firebase/firestore'
import { db } from '../firebase/config'
import { applyOrderTransaction } from './orderTransaction'
export async function saveBusinessOrder(data, editingId) {
  const orderRef = editingId
    ? doc(db, 'orders', editingId)
    : doc(collection(db, 'orders'))
  await runTransaction(db, (tx) =>
    applyOrderTransaction(tx, data, editingId, { db, doc, orderRef }),
  )
  return orderRef.id
}
