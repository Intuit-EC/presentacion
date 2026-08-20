import React, { createContext, useContext, useState, useEffect } from "react";
import type { Product } from "@/data/mock";
import { useToast } from "@/hooks/use-toast";

export interface CartItem {
  product: Product;
  quantity: number;
}

interface CartContextType {
  items: CartItem[];
  addItem: (product: Product, quantity?: number) => void;
  removeItem: (productId: string) => void;
  updateQuantity: (productId: string, quantity: number) => void;
  clearCart: () => void;
  buyNow: (product: Product) => void;
  isCartOpen: boolean;
  setIsCartOpen: (isOpen: boolean) => void;
  isCartLoading: boolean;
  cartTotal: number;
  cartItemCount: number;
}

const CartContext = createContext<CartContextType | undefined>(undefined);
const CART_STORAGE_KEY = "difiori_cart";

function persistCartItems(items: CartItem[]) {
  try {
    localStorage.setItem(CART_STORAGE_KEY, JSON.stringify(items));
  } catch (error) {
    console.error("Error saving cart", error);
  }
}

export function CartProvider({ children }: { children: React.ReactNode }) {
  const [items, setItems] = useState<CartItem[]>([]);
  const [isCartOpen, setIsCartOpen] = useState(false);
  const [isInitialized, setIsInitialized] = useState(false);
  const { toast } = useToast();

  // Load from local storage
  useEffect(() => {
    let isMounted = true;

    try {
      const saved = localStorage.getItem(CART_STORAGE_KEY);
      if (saved) {
        setItems(JSON.parse(saved));
      }
    } catch (e) {
      console.error("Error loading cart", e);
    }

    // La lectura de localStorage es síncrona; no hace falta bloquear el carrito
    // con una espera artificial antes de permitir comprar.
    if (isMounted) setIsInitialized(true);

    return () => {
      isMounted = false;
    };
  }, []);

  // Save to local storage
  useEffect(() => {
    if (isInitialized) {
      persistCartItems(items);
    }
  }, [items, isInitialized]);

  function mergeProductIntoItems(prev: CartItem[], product: Product, quantity: number) {
    const existing = prev.find((item) => item.product.id === product.id);
    if (existing) {
      return prev.map((item) =>
        item.product.id === product.id
          ? { ...item, quantity: item.quantity + quantity }
          : item
      );
    }

    return [...prev, { product, quantity }];
  }

  const addItem = (product: Product, quantity = 1) => {
    setItems((prev) => {
      const nextItems = mergeProductIntoItems(prev, product, quantity);
      persistCartItems(nextItems);
      return nextItems;
    });

    toast({
      title: "Agregado al carrito",
      description: `${product.name} ha sido agregado.`,
      duration: 3000,
    });
  };

  // "Comprar ahora" lleva al checkout con ese producto y nada mas. Sumarlo a lo
  // que hubiera guardado de visitas anteriores hacia que el cliente llegara al
  // pago con un total que no reconocia. Para llevar varios productos esta
  // "Agregar al carrito", que si acumula.
  const buyNow = (product: Product) => {
    const nextItems = [{ product, quantity: 1 }];
    persistCartItems(nextItems);
    setItems(nextItems);
  };

  const removeItem = (productId: string) => {
    setItems((prev) => {
      const nextItems = prev.filter((item) => item.product.id !== productId);
      persistCartItems(nextItems);
      return nextItems;
    });
  };

  const updateQuantity = (productId: string, quantity: number) => {
    if (quantity <= 0) {
      removeItem(productId);
      return;
    }
    setItems((prev) =>
      {
        const nextItems = prev.map((item) =>
        item.product.id === productId ? { ...item, quantity } : item
        );
        persistCartItems(nextItems);
        return nextItems;
      }
    );
  };

  const clearCart = () => {
    persistCartItems([]);
    setItems([]);
  };

  const cartTotal = items.reduce((total, item) => {
    const price = parseFloat(item.product.price.replace(/[^0-9.-]+/g, ""));
    return total + price * item.quantity;
  }, 0);

  const cartItemCount = items.reduce((count, item) => count + item.quantity, 0);

  return (
    <CartContext.Provider
      value={{
        items,
        addItem,
        buyNow,
        removeItem,
        updateQuantity,
        clearCart,
        isCartOpen,
        setIsCartOpen,
        isCartLoading: !isInitialized,
        cartTotal,
        cartItemCount,
      }}
    >
      {children}
    </CartContext.Provider>
  );
}

export function useCart() {
  const context = useContext(CartContext);
  if (context === undefined) {
    throw new Error("useCart must be used within a CartProvider");
  }
  return context;
}
