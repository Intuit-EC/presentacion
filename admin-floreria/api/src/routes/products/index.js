const express = require('express');
const router = express.Router();
const productsController = require('../../controllers/products/indexController');
const reorderController = require('../../controllers/products/reorderController');

// Obtener productos destacados
router.get('/featured', productsController.getProductsFeatured);

// Obtener todos los productos
router.get('/', productsController.getAllProducts);

// Crear un producto
router.post('/', productsController.createProduct);

// Guardar el orden del catálogo elegido en el panel
router.put('/reorder', reorderController.reorderProducts);

// Volver al orden automático
router.delete('/reorder', reorderController.resetProductOrder);

// Obtener filtros de un producto
router.get('/:productId/filters', productsController.getProductFilters);

module.exports = router;
