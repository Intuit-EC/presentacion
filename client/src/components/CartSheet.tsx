import React from "react";
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetFooter } from "@/components/ui/sheet";
import { useCart } from "@/context/CartContext";
import { useCompany } from "@/hooks/useCompany";
import { useToast } from "@/hooks/use-toast";
import { Plus, Minus, X, ShoppingBag, ShieldCheck, Truck } from "lucide-react";

export function CartSheet() {
  const { isCartOpen, setIsCartOpen, items, updateQuantity, removeItem, cartTotal } = useCart();
  const { data: company } = useCompany();
  const { toast } = useToast();

  const handleCheckout = () => {
    if (company?.settings?.acceptOrders === false) {
      toast({
        title: "Tienda cerrada temporalmente",
        description: "Por ahora no estamos recibiendo nuevos pedidos.",
        duration: 4000,
      });
      return;
    }

    setIsCartOpen(false);
    window.location.href = "/checkout";
  };

  return (
    <Sheet open={isCartOpen} onOpenChange={setIsCartOpen}>
      <SheetContent className="w-full sm:max-w-md flex flex-col h-full bg-white border-l border-primary/20 p-0">
        <SheetHeader className="p-6 border-b border-primary/10">
          <SheetTitle className="flex items-center gap-3 text-2xl font-serif italic text-foreground">
            <ShoppingBag className="w-6 h-6 text-accent" />
            Tu carrito
          </SheetTitle>
        </SheetHeader>

        <div className="flex-1 overflow-y-auto p-6 space-y-8">
          {items.length === 0 ? (
            <div className="h-full flex flex-col items-center justify-center text-center opacity-50 space-y-4">
              <ShoppingBag className="w-16 h-16 text-foreground/20" />
              <p className="text-xl font-serif italic">Tu carrito está vacío</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="text-xs uppercase tracking-widest font-black text-accent mt-4 hover:underline"
              >
                Continuar comprando
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex gap-4 items-center group relative">
                <div className="w-20 h-24 rounded-2xl overflow-hidden flex-shrink-0 bg-white border border-primary/20">
                  <img src={item.product.image} alt={item.product.name} className="w-full h-full object-contain p-1" />
                </div>
                
                <div className="flex-1 flex flex-col gap-1">
                  <h4 className="font-bold text-foreground leading-tight text-sm pr-6">{item.product.name}</h4>
                  <p className="text-xs text-foreground/50">{item.product.price}</p>
                  
                  <div className="flex items-center gap-4 mt-2">
                    <div className="flex items-center gap-3 bg-muted px-2 py-1 rounded-full">
                      <button 
                        type="button"
                        aria-label={`Reducir cantidad de ${item.product.name}`}
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="text-foreground/60 hover:text-accent transition-colors"
                      >
                        <Minus className="w-3 h-3" />
                      </button>
                      <span className="text-xs font-black min-w-[12px] text-center">{item.quantity}</span>
                      <button 
                        type="button"
                        aria-label={`Aumentar cantidad de ${item.product.name}`}
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="text-foreground/60 hover:text-accent transition-colors"
                      >
                        <Plus className="w-3 h-3" />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  type="button"
                  aria-label={`Quitar ${item.product.name} del carrito`}
                  onClick={() => removeItem(item.product.id)}
                  className="absolute top-0 right-0 p-1 text-foreground/30 hover:text-red-500 transition-colors"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <SheetFooter className="p-6 border-t border-primary/10 bg-primary/5 flex-col gap-4">
            <div className="flex flex-col items-center justify-center w-full mb-4 gap-1">
              <span className="text-xs text-foreground/60 uppercase tracking-widest font-bold">Subtotal del pedido</span>
              <span className="text-4xl font-black">${cartTotal.toFixed(2)}</span>
              <span className="mt-1 text-center text-xs text-foreground/60">El envío se calcula según el sector en el checkout.</span>
            </div>
            <div className="grid w-full grid-cols-2 gap-2 text-[11px] font-bold text-foreground/65">
              <span className="flex items-center justify-center gap-1.5"><ShieldCheck className="h-4 w-4 text-accent" /> Pago seguro</span>
              <span className="flex items-center justify-center gap-1.5"><Truck className="h-4 w-4 text-accent" /> Entrega coordinada</span>
            </div>
            <div className="flex flex-col gap-3 w-full">
              <button 
                onClick={handleCheckout}
                className="w-full bg-accent hover:bg-accent/90 text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-lg"
              >
                Continuar al checkout
              </button>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-transparent border-2 border-accent text-accent hover:bg-accent hover:text-white py-4 rounded-2xl font-black text-xs uppercase tracking-widest transition-all"
              >
                Seguir Comprando
              </button>
            </div>
          </SheetFooter>
        )}
      </SheetContent>
    </Sheet>
  );
}
