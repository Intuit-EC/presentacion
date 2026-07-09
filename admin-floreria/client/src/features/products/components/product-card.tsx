import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/shared/components/ui/card";
import { Badge } from "@/shared/components/ui/badge";
import { Button } from "@/shared/components/ui/button";
import type { FormData, Product, Variant } from "../types";
import { ProductModal } from "./product-modal";
import { getImageUrl } from "@/core/utils/variables";
import { ProductAlert } from "./product-alert";
import { ArrowDown, ArrowUp, GripVertical } from "lucide-react";

type ProductCardProps = {
  product: Product;
  handleEdit: (product?: Product) => void;
  handleDelete: (productId: string) => void;
  open: boolean;
  setOpen: React.Dispatch<React.SetStateAction<boolean>>;
  // handleShow: (product?: Product) => void;
  handleSubmit: (e: React.FormEvent) => void;
  formData: FormData;
  categorySuggestions: string[];
  setFormData: React.Dispatch<
    React.SetStateAction<ProductCardProps["formData"]>
  >;
  variants: Array<Variant>;
  setVariants: React.Dispatch<
    React.SetStateAction<ProductCardProps["variants"]>
  >;
  editingProduct?: { id: string } | null;
  index: number;
  totalProducts: number;
  canReorder: boolean;
  moveProduct: (fromIndex: number, toIndex: number) => void;
  addVariant: () => void;
  moveVariant: (fromIndex: number, toIndex: number) => void;
  updateVariant: (
    index: number,
    field: string,
    value: string | number | boolean
  ) => void;
  removeVariant: (index: number) => void;
};

// function sortDiscountsForApplication(discounts: Product["discounts"]) {
//   return [...discounts].sort((a, b) => {
//     if (a.priority !== b.priority) return b.priority - a.priority;
//     if (a.percent !== b.percent) return b.percent - a.percent;
//     return a.id - b.id;
//   });
// }

// function clampPercentValue(value: number) {
//   if (!Number.isFinite(value)) return 0;
//   return Math.max(0, Math.min(1, value));
// }

// function getEffectivePercentValue(discounts: Product["discounts"]) {
//   const ordered = sortDiscountsForApplication(discounts);
//   if (ordered.length === 0) return { effectivePercentValue: 0, applied: [] as typeof ordered };

//   const hasNonStackable = ordered.some((d) => !d.stackable);
//   if (hasNonStackable) {
//     const best = ordered[0];
//     return { effectivePercentValue: clampPercentValue(best.percent_value), applied: [best] };
//   }

//   let remaining = 1;
//   for (const d of ordered) {
//     const pv = clampPercentValue(d.percent_value);
//     remaining *= 1 - pv;
//   }

//   return { effectivePercentValue: clampPercentValue(1 - remaining), applied: ordered };
// }

export function ProductCard({
  product,
  handleEdit,
  handleDelete,
  open,
  setOpen,
  handleSubmit,
  formData,
  categorySuggestions,
  setFormData,
  variants,
  setVariants,
  editingProduct,
  index,
  totalProducts,
  canReorder,
  moveProduct,
  addVariant,
  moveVariant,
  updateVariant,
  removeVariant,
}: ProductCardProps) {
  return (
    <Card className="py-0 flex flex-col h-full min-h-[450px] sm:min-h-[500px]">
      <div className="relative w-full h-40 sm:h-48 overflow-hidden rounded-t-lg flex-shrink-0">
        <img
          src={getImageUrl(product.image)}
          alt={product.name}
          className="object-cover w-full h-full"
        />
      </div>
      <CardHeader className="pb-2 sm:pb-3 flex-shrink-0">
        <div className="mb-2 flex items-center justify-between gap-2 rounded-lg border border-dashed border-gray-200 bg-gray-50 px-2 py-1">
          <span className="inline-flex items-center gap-1 text-xs font-medium text-gray-600">
            <GripVertical className="h-3.5 w-3.5" />
            Posición #{index + 1}
          </span>
          <div className="flex gap-1">
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => moveProduct(index, index - 1)}
              disabled={!canReorder || index === 0}
              aria-label={`Subir ${product.name}`}
              title={
                canReorder
                  ? "Subir producto"
                  : "Limpia la búsqueda para reordenar la lista completa"
              }
            >
              <ArrowUp className="h-3.5 w-3.5" />
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="h-7 w-7 p-0"
              onClick={() => moveProduct(index, index + 1)}
              disabled={!canReorder || index === totalProducts - 1}
              aria-label={`Bajar ${product.name}`}
              title={
                canReorder
                  ? "Bajar producto"
                  : "Limpia la búsqueda para reordenar la lista completa"
              }
            >
              <ArrowDown className="h-3.5 w-3.5" />
            </Button>
          </div>
        </div>
        <CardTitle className="text-base sm:text-lg line-clamp-2">
          {product.name}
        </CardTitle>
        <CardDescription className="text-xs sm:text-sm">
          {product.category}
        </CardDescription>
        <div className="flex flex-wrap gap-1 mt-2">
          <Badge
            variant={product.isActive ? "default" : "secondary"}
            className="text-xs"
          >
            {product.isActive ? "Activo" : "Inactivo"}
          </Badge>
          {product.featured && (
            <Badge variant="outline" className="text-xs">
              Destacado
            </Badge>
          )}
          {product.hasVariants && (
            <Badge variant="outline" className="text-xs bg-blue-50">
              Variantes
            </Badge>
          )}
        </div>
      </CardHeader>
      <CardContent className="flex flex-col flex-1 pb-3 sm:pb-4 px-3 sm:px-6">
        <div className="flex flex-col h-full gap-3">
          {product.description && (
            <p className="text-xs sm:text-sm text-gray-600 line-clamp-3">
              {product.description}
            </p>
          )}

          <div className="flex flex-col gap-1">
            <span className="text-lg sm:text-xl font-semibold">
              {product.hasVariants
                ? product.variants && product.variants.length > 0
                  ? `$${
                      product.variants.find((v) => v.isDefault)?.price ||
                      product.variants[0].price
                    }`
                  : "Ver variantes"
                : `$${product.price || 0}`}
            </span>
            <span className="text-xs sm:text-sm text-gray-500">
              Stock: {product.stock}
            </span>
          </div>

          {product.discounts.length > 0 && (
            <div className="flex flex-col gap-1">
              {product.discounts.map((discount, index) => {
                const basePrice = product.hasVariants 
                  ? (product.variants?.find((v) => v.isDefault)?.price || product.variants?.[0]?.price || 0)
                  : (product.price || 0);
                const discountedPrice = basePrice - (basePrice * discount.percent_value);
                
                return (
                  <p key={index} className="text-xs sm:text-sm text-green-600">
                    {discount.percent}% OFF - {discountedPrice.toLocaleString("es-AR", { style: "currency", currency: "ARS" })}
                  </p>
                );
              })}
            </div>
          )}

          <div className="mt-auto pt-2 flex gap-2 justify-end">
            <ProductModal
              typeform="edit"
              open={open}
              setOpen={setOpen}
              handleShow={handleEdit}
              handleSubmit={handleSubmit}
              formData={formData}
              categorySuggestions={categorySuggestions}
              setFormData={setFormData}
              variants={variants}
              setVariants={setVariants}
              editingProduct={editingProduct}
              addVariant={addVariant}
              moveVariant={moveVariant}
              updateVariant={updateVariant}
              removeVariant={removeVariant}
            />
            <ProductAlert product={product} handleDelete={handleDelete} />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
