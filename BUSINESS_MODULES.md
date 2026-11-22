# Mejoras comerciales y configuración

Esta rama incluye las correcciones de 11133ffc del PR 29 y añade categorías de pedidos, mangas, tallas manuales, gastos, catálogos y la cotización con los datos de Arte Grafía.

## Pedidos y productos

- Las categorías del pedido son Prenda, Producto y Publicidad. La categoría se elige primero y se conserva al editar.
- Prenda admite inventario o una prenda del cliente. Producto utiliza exclusivamente inventario. Publicidad utiliza descripción, monto total e imágenes, con cantidad interna igual a uno.
- El precio base se escribe al cotizar; el precio de inventario es una referencia y no sustituye la entrada manual. Para prendas, cada área tiene tamaño y recargo por unidad; se suman al precio base y luego se multiplica por la cantidad.
- La talla se escribe manualmente al crear una prenda del inventario y en prendas del cliente. En pedidos del inventario se conserva la talla del producto para no mezclar sus existencias.
- Se admiten frente, espalda, frente y espalda, manga izquierda, manga derecha y ambas mangas. Cada fotografía y cada elemento del editor corresponde a su área. Los elementos antiguos sin área conservan su comportamiento anterior.
- Solo Prenda requiere IA antes de guardar. Cambiar el diseño o los datos usados por la IA invalida el resultado; no se acepta una respuesta que llegó después de modificar el diseño.
- Publicidad y Producto admiten hasta ocho imágenes de referencia. Se guardan una sola vez y se incluyen en el PDF.
- Guardar crea un pendiente sin pago confirmado. Se conserva el proceso de aprobación, anticipo, producción y entrega del historial. Editar no borra pagos ni descuenta nuevamente todo el stock. Las reservas y ajustes de inventario utilizan transacciones.

## Roles

| Función | Administrador | Empleado |
|---|---|---|
| Crear y consultar pedidos de las tres categorías | Sí | Sí |
| Administrar inventario | Sí | No |
| Gastos y sus resúmenes | Sí | No |
| Consultar Catálogos | Sí | Sí |
| Crear editar y eliminar Catálogos | Sí | No |
| Anular o eliminar pedidos | Sí | No |

Los permisos se aplican en rutas, botones y reglas de Firebase. Los usuarios inactivos no reciben acceso operativo.

## Gastos

Se registra descripción, monto, fecha, proveedor o beneficiario, comprobante, forma de pago y notas. El filtro inicia en el mes actual hasta hoy, con límites inclusivos. Las tarjetas permiten elegir total cotizado o total cobrado de los pedidos cuya fecha de toma cae en el período. Los gastos usan su propia fecha. Se excluyen pedidos anulados. La diferencia es cotizado menos gastos o cobrado menos gastos; no se presenta como utilidad contable. El modo cobrado usa el pago acumulado del conjunto de pedidos seleccionado, no un libro de caja por fecha individual de cada cobro.

## Compatibilidad

Los registros sin categoría se consideran prendas. No se distribuye automáticamente el stock de registros antiguos con varias tallas: deben separarse con existencias reales y desactivarse los anteriores. No se elimina información ni se migran datos en producción al subir el código.

## Publicación

1. Revisar y probar la rama de vista previa con cuentas de administrador y empleado.
2. Publicar conjuntamente firestore.rules y storage.rules en el proyecto Firebase correcto. Sin las reglas nuevas, Gastos y Catálogos serán rechazados por las reglas anteriores.
3. Desplegar el backend y revisar FIREBASE_PROJECT_ID, GROQ_API_KEY y ALLOWED_ORIGINS. En Netlify, VITE_API_URL debe apuntar al backend con verificación de token habilitada. Autorizar los orígenes de vista previa necesarios.
4. Comprobar CORS de las fotografías y la exportación del canvas desde cada origen autorizado.
5. Verificar el PDF y realizar un pedido de prueba de cada categoría antes de integrar en main.

Las reglas no se publican automáticamente por modificar sus archivos. Esta implementación no ejecuta despliegues ni escribe datos de prueba en producción.

## Datos de la cotización

Logo oficial del repositorio, teléfono 5425-3023, Facebook e Instagram ArteGrafía con iconos y dirección Avenida Chipilapa 3-69, zona 2, Barrio La Esperanza, Jalapa, Guatemala. Dirección tomada del documento de referencia proporcionado por la propietaria.

## Verificación

- Frontend: npm ci, npm run lint y npm run build en frontend.
- Pruebas de lógica y API: npm ci y npm test en backend. En Windows puede ser necesario establecer TEMP y TMP en una carpeta de trabajo escribible para Vitest.
- Reglas y concurrencia: npm ci en frontend; iniciar el emulador con `npx firebase-tools emulators:start --only firestore --project demo-asistente-test --config firebase.test.json` desde la raíz. En otra terminal ejecutar `node frontend/tests/firestore.rules.mjs`. Requiere Java 21 o superior. No utilizar el proyecto de producción para estas pruebas.
- Las pruebas del navegador se realizaron con datos locales y una respuesta de IA simulada. Debe comprobarse la integración real con Firebase y Groq en el entorno de vista previa.
