import service from "@/core/api/service";

const get = async (params: URLSearchParams) => {
  const response = await service.get("/products", { params });
  return response.data;
};

const getById = async (id: string) => {
  const response = await service.get(`/products/${id}`);
  return response.data;
};

const create = async (data: object) => {
  const response = await service.post("/products", data);
  return response.data;
};

const update = async (id: string, data: object) => {
  const response = await service.put(`/products/${id}`, data);
  return response.data;
};

const remove = async (id: string) => {
  const response = await service.delete(`/products/${id}`);
  return response.data;
};

const uploadImage = async (file: File) => {
  const formData = new FormData();
  formData.append("file", file);
  const response = await service.post(`/upload`, formData);
  return response.data;
};

/** Guarda en el servidor el orden en que quedaron las tarjetas del panel. */
const reorder = async (productIds: string[]) => {
  const response = await service.put("/products/reorder", { productIds });
  return response.data;
};

/** Devuelve el catálogo al orden automático. */
const resetOrder = async () => {
  const response = await service.delete("/products/reorder");
  return response.data;
};

const getProductFilters = async (productId: string) => {
  const response = await service.get(`/products/${productId}/filters`);
  return response.data;
};

const productsService = {
  get,
  getById,
  create,
  update,
  remove,
  uploadImage,
  getProductFilters,
  reorder,
  resetOrder,
};

export default productsService;
