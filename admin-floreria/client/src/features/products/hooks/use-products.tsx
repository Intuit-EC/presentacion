import { useEffect, useState } from "react";
import { toast } from "sonner";
import type { FormData, Product, Variant } from "../types";
import productsService from "../api/products-service";
import { useUserStore } from "@/store/use-user-store";
import filtersService from "@/features/filters/api/filters-service";

const ADMIN_PRODUCT_ORDER_KEY = "difiori-admin-product-card-order";

function readAdminProductOrder() {
  try {
    const rawValue = window.localStorage.getItem(ADMIN_PRODUCT_ORDER_KEY);
    const parsed = rawValue ? JSON.parse(rawValue) : [];
    return Array.isArray(parsed) ? parsed.filter(Boolean) : [];
  } catch {
    return [];
  }
}

function saveAdminProductOrder(productIds: string[]) {
  try {
    window.localStorage.setItem(
      ADMIN_PRODUCT_ORDER_KEY,
      JSON.stringify(productIds)
    );
  } catch {
    // Si el navegador bloquea localStorage, el orden visual sigue funcionando
    // durante la sesión actual.
  }
}

function clearAdminProductOrder() {
  try {
    window.localStorage.removeItem(ADMIN_PRODUCT_ORDER_KEY);
  } catch {
    // No action needed.
  }
}

function applyAdminProductOrder(productList: Product[]) {
  const savedOrder = readAdminProductOrder();
  if (savedOrder.length === 0) return productList;

  const productsById = new Map(productList.map((product) => [product.id, product]));
  const orderedProducts = savedOrder
    .map((id) => productsById.get(id))
    .filter((product): product is Product => Boolean(product));
  const visibleOrderedIds = new Set(orderedProducts.map((product) => product.id));
  const remainingProducts = productList.filter(
    (product) => !visibleOrderedIds.has(product.id)
  );

  return [...orderedProducts, ...remainingProducts];
}

export default function useProducts() {
  const { user } = useUserStore();
  const [products, setProducts] = useState<Product[]>([]);
  const [categorySuggestions, setCategorySuggestions] = useState<string[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showModal, setShowModal] = useState(false);
  const [editingProduct, setEditingProduct] = useState<Product | null>(null);
  const [formData, setFormData] = useState<FormData>({
    name: "",
    description: "",
    image: "",
    category: "",
    stock: 0,
    price: 0,
    isActive: true,
    featured: false,
    hasVariants: false,
  });

  const [variants, setVariants] = useState<Array<Variant>>([]);

  const syncCategorySuggestions = (
    productList: Product[],
    filterLabels: string[] = []
  ) => {
    const merged = new Set<string>();

    filterLabels.forEach((label) => {
      const normalized = label.trim();
      if (normalized) merged.add(normalized);
    });

    productList.forEach((product) => {
      const normalized = product.category?.trim();
      if (normalized) merged.add(normalized);
    });

    setCategorySuggestions(
      Array.from(merged).sort((a, b) => a.localeCompare(b, "es"))
    );
  };

  const fetchProducts = async () => {
    try {
      const params = new URLSearchParams();
      if (search) params.append("search", search);

      const response = await productsService.get(params);
      const { status, message, data } = response;

      if (status === "success" && data) {
        const orderedProducts = applyAdminProductOrder(data || []);
        setProducts(orderedProducts);
        syncCategorySuggestions(orderedProducts, categorySuggestions);
      } else {
        toast.error(message || "Error al cargar productos");
      }
    } catch (error) {
      console.error("Fetch products error:", error);
      toast.error("Error de conexión");
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProducts();
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    const fetchCategorySuggestions = async () => {
      try {
        const response = await filtersService.getCategories();
        if (response.status === "success" && response.data) {
          const filterLabels = response.data
            .map((category) => category.label?.trim() || category.name?.trim() || "")
            .filter(Boolean);
          syncCategorySuggestions(products, filterLabels);
        }
      } catch (error) {
        console.error("Fetch category suggestions error:", error);
      }
    };

    fetchCategorySuggestions();
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    try {
      const data = {
        product: {
          id: editingProduct?.id ?? "",
          name: formData.name,
          description: formData.description,
          image: formData.image,
          category: formData.category,
          stock: formData.stock,
          isActive: formData.isActive,
          featured: formData.featured,
          hasVariants: formData.hasVariants,
          createdAt: new Date().toISOString(),
          price: formData.price,
          userId: user?.id,
        },
        ...(formData.hasVariants && { variants }),
      };

      if (editingProduct) {
        const response = await productsService.update(editingProduct.id, data);
        if (response.status === "success") {
          toast.success(response.message);
          setEditingProduct(null);
          setShowModal(false);
          resetForm();
          await fetchProducts();
        }
      } else {
        const response = await productsService.create(data);
        if (response.status === "success") {
          toast.success(response.message);
          setEditingProduct(null);
          setShowModal(false);
          resetForm();
          await fetchProducts();
        }
      }
    } catch (error) {
      console.error("Submit error:", error);
      toast.error("Error de conexión");
    }
  };

  const handleNew = () => {
    setEditingProduct(null);
    resetForm();
    setShowModal(true);
  };

  const handleEdit = (product: Product) => {
    setEditingProduct(product);
    setShowModal(true);
    setFormData({
      name: product.name,
      description: product.description || "",
      image: product.image || "",
      category: product.category,
      stock: product.stock,
      price: product.price || 0,
      isActive: product.isActive,
      featured: product.featured,
      hasVariants: product.hasVariants,
    });

    if (product.variants && product.variants.length > 0) {
      setVariants(
        product.variants.map((variant, index) => ({
          id: variant.id,
          name: variant.name,
          price: variant.price,
          isDefault: variant.isDefault,
          sortOrder: variant.sortOrder || index,
        }))
      );
    } else {
      setVariants([]);
    }
  };

  const handleDelete = async (id: string) => {
    try {
      const response = await productsService.remove(id);

      if (response.status === "success") {
        toast.success("Producto eliminado");
        fetchProducts();
      } else {
        toast.error(response.message || "Error al eliminar producto");
      }
    } catch (error) {
      console.error("Delete error:", error);
      toast.error("Error de conexión");
    }
  };

  const resetForm = () => {
    setFormData({
      name: "",
      description: "",
      image: "",
      category: "",
      stock: 0,
      price: 0,
      isActive: true,
      featured: false,
      hasVariants: false,
    });
    setVariants([]);
  };

  const addVariant = () => {
    const newVariant = {
      name: "",
      price: 0,
      isDefault: variants.length === 0,
      sortOrder: variants.length,
    };
    setVariants([...variants, newVariant]);
  };

  const updateVariant = (
    index: number,
    field: string,
    value: string | number | boolean
  ) => {
    const newVariants = [...variants];
    newVariants[index] = { ...newVariants[index], [field]: value };

    if (field === "isDefault" && value === true) {
      newVariants.forEach((variant, i) => {
        if (i !== index) variant.isDefault = false;
      });
    }

    setVariants(newVariants);
  };

  const removeVariant = (index: number) => {
    const newVariants = variants.filter((_, i) => i !== index);

    if (variants[index].isDefault && newVariants.length > 0) {
      newVariants[0].isDefault = true;
    }

    setVariants(newVariants);
  };

  const moveVariant = (fromIndex: number, toIndex: number) => {
    const newVariants = [...variants];
    const [removed] = newVariants.splice(fromIndex, 1);
    newVariants.splice(toIndex, 0, removed);

    newVariants.forEach((variant, index) => {
      variant.sortOrder = index;
    });

    setVariants(newVariants);
  };

  const moveProduct = async (fromIndex: number, toIndex: number) => {
    if (toIndex < 0 || toIndex >= products.length || fromIndex === toIndex) return;

    const reorderedProducts = [...products];
    const [removed] = reorderedProducts.splice(fromIndex, 1);
    reorderedProducts.splice(toIndex, 0, removed);

    setProducts(reorderedProducts);
    saveAdminProductOrder(reorderedProducts.map((product) => product.id));
    toast.success("Orden visual del administrador actualizado");
  };

  const resetProductOrder = async () => {
    clearAdminProductOrder();
    toast.success("Ubicación visual restablecida");
    await fetchProducts();
  };

  return {
    products,
    search,
    isLoading,
    categorySuggestions,
    formData,
    variants,
    showModal,
    editingProduct,
    setSearch,
    setShowModal,
    setFormData,
    setVariants,
    handleSubmit,
    handleNew,
    handleEdit,
    handleDelete,
    resetForm,
    addVariant,
    updateVariant,
    removeVariant,
    moveVariant,
    moveProduct,
    resetProductOrder,
    fetchProducts,
  };
}
