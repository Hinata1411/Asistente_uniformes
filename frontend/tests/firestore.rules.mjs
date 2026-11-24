import { readFile } from 'node:fs/promises'
import {
  initializeTestEnvironment,
  assertSucceeds,
  assertFails,
} from '@firebase/rules-unit-testing'
import {
  doc,
  setDoc,
  getDoc,
  updateDoc,
  deleteDoc,
  getDocs,
  collection,
} from 'firebase/firestore'
import assert from 'node:assert/strict'
import { runTransaction } from 'firebase/firestore'
import { applyOrderTransaction } from '../src/services/orderTransaction.js'
const env = await initializeTestEnvironment({
  projectId: 'demo-asistente-test',
  firestore: {
    host: '127.0.0.1',
    port: 8089,
    rules: await readFile(
      new URL('../../firestore.rules', import.meta.url),
      'utf8',
    ),
  },
})
let count = 0
const check = async (name, fn) => {
  await fn()
  count++
  console.log('OK ' + name)
}
try {
  await env.withSecurityRulesDisabled(async (ctx) => {
    for (const [uid, role, active] of [
      ['admin', 'admin', true],
      ['empleado', 'empleado', true],
      ['inactivo', 'admin', false],
    ])
      await setDoc(doc(ctx.firestore(), 'users', uid), { role, active })
    await setDoc(doc(ctx.firestore(), 'products', 'p'), {
      category: 'prenda',
      name: 'Prenda',
      size: 'Manual 42',
      price: 50,
      stock: 5,
    })
    await setDoc(doc(ctx.firestore(), 'catalogs', 'c'), {
      name: 'Colección',
      url: 'https://example.com',
    })
    await setDoc(doc(ctx.firestore(), 'expenses', 'e'), {
      description: 'Material',
      amount: 10,
      date: '2026-10-28',
    })
  })
  const admin = env.authenticatedContext('admin').firestore(),
    employee = env.authenticatedContext('empleado').firestore(),
    inactive = env.authenticatedContext('inactivo').firestore(),
    anonymous = env.unauthenticatedContext().firestore()
  const expense = {
    description: 'Compra',
    amount: 25,
    date: '2026-10-28',
    provider: 'Proveedor',
    reference: 'F1',
    notes: '',
    paymentMethod: 'Efectivo',
  }
  await check('administrador registra gasto', () =>
    assertSucceeds(setDoc(doc(admin, 'expenses', 'nuevo'), expense)),
  )
  await check('administrador edita gasto', () =>
    assertSucceeds(updateDoc(doc(admin, 'expenses', 'nuevo'), { amount: 30 })),
  )
  await check('empleado no lee gastos', () =>
    assertFails(getDocs(collection(employee, 'expenses'))),
  )
  await check('empleado no crea gastos', () =>
    assertFails(setDoc(doc(employee, 'expenses', 'prohibido'), expense)),
  )
  await check('empleado no edita gastos', () =>
    assertFails(updateDoc(doc(employee, 'expenses', 'e'), { amount: 1 })),
  )
  await check('empleado no elimina gastos', () =>
    assertFails(deleteDoc(doc(employee, 'expenses', 'e'))),
  )
  await check('inactivo no accede a gastos', () =>
    assertFails(getDoc(doc(inactive, 'expenses', 'e'))),
  )
  await check('anónimo no accede a catálogos', () =>
    assertFails(getDoc(doc(anonymous, 'catalogs', 'c'))),
  )
  await check('empleado consulta catálogos', () =>
    assertSucceeds(getDocs(collection(employee, 'catalogs'))),
  )
  await check('empleado no crea catálogos', () =>
    assertFails(
      setDoc(doc(employee, 'catalogs', 'otro'), {
        name: 'Prueba',
        url: 'https://example.com',
      }),
    ),
  )
  await check('empleado no edita catálogos', () =>
    assertFails(updateDoc(doc(employee, 'catalogs', 'c'), { name: 'Cambio' })),
  )
  await check('empleado no elimina catálogos', () =>
    assertFails(deleteDoc(doc(employee, 'catalogs', 'c'))),
  )
  await check('administrador crea catálogo', () =>
    assertSucceeds(
      setDoc(doc(admin, 'catalogs', 'nuevo'), {
        name: 'Colección',
        url: 'https://example.com',
      }),
    ),
  )
  await check('enlace ejecutable rechazado por reglas', () =>
    assertFails(
      setDoc(doc(admin, 'catalogs', 'invalido'), {
        name: 'Malo',
        url: 'javascript:alert(1)',
      }),
    ),
  )
  await check('gasto negativo rechazado', () =>
    assertFails(
      setDoc(doc(admin, 'expenses', 'negativo'), { ...expense, amount: -1 }),
    ),
  )
  await check('empleado no cambia categoría del inventario', () =>
    assertFails(
      updateDoc(doc(employee, 'products', 'p'), { category: 'producto' }),
    ),
  )
  await check('empleado puede descontar stock', () =>
    assertSucceeds(updateDoc(doc(employee, 'products', 'p'), { stock: 4 })),
  )
  await check('stock negativo rechazado', () =>
    assertFails(updateDoc(doc(employee, 'products', 'p'), { stock: -1 })),
  )
  await check('empleado no eleva su rol', () =>
    assertFails(
      updateDoc(doc(employee, 'users', 'empleado'), { role: 'admin' }),
    ),
  )
  for (const [category, garmentSource] of [
    ['prenda', 'inventory'],
    ['producto', 'inventory'],
    ['publicidad', 'advertising'],
  ]) {
    const order = {
      category,
      garmentSource,
      quantity: 1,
      quoteTotal: 100,
      status: 'pendiente_aprobacion',
    }
    await check('empleado registra ' + category, () =>
      assertSucceeds(setDoc(doc(employee, 'orders', category), order)),
    )
    await check('empleado no elimina ' + category, () =>
      assertFails(deleteDoc(doc(employee, 'orders', category))),
    )
  }
  await check('producto no admite origen de cliente', () =>
    assertFails(
      setDoc(doc(employee, 'orders', 'mala-categoria'), {
        category: 'producto',
        garmentSource: 'customer',
        quantity: 1,
        quoteTotal: 100,
        status: 'pendiente_aprobacion',
      }),
    ),
  )
  await check('administrador elimina gasto', () =>
    assertSucceeds(deleteDoc(doc(admin, 'expenses', 'nuevo'))),
  )
  await check('reservas concurrentes no sobrevenden inventario', async () => {
    await env.withSecurityRulesDisabled((ctx) =>
      setDoc(doc(ctx.firestore(), 'products', 'ultimo'), {
        category: 'producto',
        name: 'Último',
        price: 0,
        stock: 1,
        active: true,
      }),
    )
    const payload = {
      category: 'producto',
      garmentSource: 'inventory',
      productId: 'ultimo',
      quantity: 1,
      size: '',
      quoteTotal: 25,
      paymentPlan: 'anticipo_50',
    }
    const reserve = (id) =>
      runTransaction(employee, (tx) =>
        applyOrderTransaction(tx, payload, null, {
          db: employee,
          doc,
          orderRef: doc(employee, 'orders', id),
        }),
      )
    const results = await Promise.allSettled([
      reserve('reserva-1'),
      reserve('reserva-2'),
    ])
    assert.equal(results.filter((r) => r.status === 'fulfilled').length, 1)
    assert.equal(
      (await getDoc(doc(employee, 'products', 'ultimo'))).data().stock,
      0,
    )
  })
  await check(
    'editar sin cambiar cantidad no descuenta stock otra vez',
    async () => {
      const before = (await getDoc(doc(employee, 'products', 'p'))).data().stock
      const target = doc(employee, 'orders', 'edicion')
      const payload = {
        category: 'prenda',
        garmentSource: 'inventory',
        productId: 'p',
        size: 'Manual 42',
        quantity: 1,
        quoteTotal: 80,
        paymentPlan: 'anticipo_50',
      }
      await runTransaction(employee, (tx) =>
        applyOrderTransaction(tx, payload, null, {
          db: employee,
          doc,
          orderRef: target,
        }),
      )
      await updateDoc(target, {
        status: 'aprobado',
        depositPaid: 40,
        totalPaid: 40,
      })
      await runTransaction(employee, (tx) =>
        applyOrderTransaction(tx, { ...payload, quoteTotal: 90 }, 'edicion', {
          db: employee,
          doc,
          orderRef: target,
        }),
      )
      const saved = (await getDoc(target)).data()
      assert.equal(saved.depositPaid, 40)
      assert.equal(saved.balanceDue, 50)
      assert.equal(
        (await getDoc(doc(employee, 'products', 'p'))).data().stock,
        before - 1,
      )
    },
  )
  assert.equal(count, 29)
  console.log(`${count} comprobaciones de permisos satisfactorias`)
} finally {
  await env.cleanup()
}
