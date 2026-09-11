# Orden del catálogo

Desde el panel de administración se puede decidir en qué orden ven los productos
los clientes en la tienda.

## Qué cambió

Antes, las flechas de cada tarjeta movían los productos **solo en el navegador
del administrador**: el orden se guardaba en `localStorage`, así que

- la tienda seguía mostrando los productos por fecha de creación,
- otro administrador veía un orden distinto,
- y todo se perdía al cambiar de equipo o limpiar el navegador.

Ahora el orden se guarda en el servidor y es el mismo en el panel y en la tienda.

## Cómo se usa

En **Productos**, las flechas de cada tarjeta suben o bajan el producto. Cada
movimiento se guarda solo, y el aviso confirma que así lo verán los clientes.

El botón **Volver al orden automático** borra las posiciones y deja el catálogo
ordenado como antes: lo más reciente primero.

Mientras haya una búsqueda activa no se puede reordenar, para no mover productos
usando posiciones parciales.

## Paso necesario al desplegar

La posición se guarda en una columna nueva (`sortOrder`) de la tabla de
productos. **Antes de subir esta versión hay que crearla**:

```bash
cd admin-floreria/api
npm run db:add-product-order
```

El script se puede ejecutar varias veces sin problema: crea la columna y el
índice solo si no existen. Además asigna a cada producto su posición actual
(la que ya tenía por fecha), de modo que el catálogo **se ve igual que antes**
hasta que alguien mueva algo.

Si se despliega sin ejecutarlo, la API fallará al pedir productos porque la
columna no existirá.

## Cómo funciona por dentro

| Pieza | Qué hace |
|---|---|
| `products.sortOrder` | Posición del producto. Nulo = sin ordenar todavía |
| `PUT /api/products/reorder` | Recibe los ids en el orden deseado y los guarda |
| `DELETE /api/products/reorder` | Borra las posiciones (orden automático) |
| API pública y del panel | Ordenan por `sortOrder` y dejan al final los nulos |
| Tienda | Respeta el orden recibido sin reordenar por su cuenta |

Las posiciones empiezan en 1, para que "sin posición" y "primera posición" no se
confundan al leer la base de datos.

Se aceptan listas parciales: si se reordena solo una categoría, los productos que
no vienen en la lista conservan la posición que tenían.

## Pruebas

```bash
cd admin-floreria/api
npm run test:reorder
```

Cubre listas vacías, productos repetidos, identificadores con espacios, listas
desproporcionadas, productos borrados a mitad de camino y el cálculo de
posiciones al mover una tarjeta.
