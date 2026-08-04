import React from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { useCart } from "@/context/CartContext";
import { Plus, Minus, X, ShoppingBag, ArrowLeft } from "lucide-react";
import { Link } from "wouter";

export function CartDialog() {
  const { isCartOpen, setIsCartOpen, items, updateQuantity, removeItem, cartTotal, clearCart } = useCart();

  return (
    <Dialog open={isCartOpen} onOpenChange={setIsCartOpen}>
      <DialogContent className="w-full sm:max-w-2xl bg-[#2A1B38] border-[#5A3F73]/40 p-0 overflow-hidden rounded-[3rem]">
        <DialogHeader className="p-8 border-b border-[#5A3F73]/20 bg-[#3D2852]/30">
          <DialogTitle className="flex items-center gap-4 text-3xl font-serif font-bold text-white">
            <ShoppingBag className="w-8 h-8 text-[#5A3F73]" />
            Tu Pedido
          </DialogTitle>
        </DialogHeader>

        <div className="p-8 space-y-8 max-h-[60vh] overflow-y-auto custom-scrollbar">
          {items.length === 0 ? (
            <div className="flex flex-col items-center justify-center text-center py-12 space-y-4">
              <ShoppingBag className="w-20 h-20 text-[#5A3F73]/20" />
              <p className="text-2xl font-serif italic text-white/40">Tu carrito está vacío</p>
              <button 
                onClick={() => setIsCartOpen(false)}
                className="text-xs uppercase tracking-widest font-black text-[#5A3F73] mt-4 hover:underline"
              >
                Volver a la tienda
              </button>
            </div>
          ) : (
            items.map((item) => (
              <div key={item.product.id} className="flex gap-6 items-center group relative bg-[#3D2852]/20 p-4 rounded-3xl border border-[#5A3F73]/10">
                <div className="w-24 h-28 rounded-2xl overflow-hidden flex-shrink-0 border border-[#5A3F73]/30">
                  <img src={item.product.image} alt={item.product.name} className="w-full h-full object-cover" />
                </div>
                
                <div className="flex-1 flex flex-col gap-2">
                  <h4 className="font-bold text-white leading-tight text-lg pr-8">{item.product.name}</h4>
                  <p className="text-sm text-[#5A3F73] font-black">{item.product.price}</p>
                  
                  <div className="flex items-center gap-6 mt-4">
                    <div className="flex items-center gap-4 bg-[#3D2852]/50 px-4 py-2 rounded-full border border-[#5A3F73]/20">
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity - 1)}
                        className="text-white/60 hover:text-[#5A3F73] transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <span className="text-sm font-black min-w-[20px] text-center text-white">{item.quantity}</span>
                      <button 
                        onClick={() => updateQuantity(item.product.id, item.quantity + 1)}
                        className="text-white/60 hover:text-[#5A3F73] transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  </div>
                </div>

                <button 
                  onClick={() => removeItem(item.product.id)}
                  className="absolute top-4 right-4 p-2 text-white/20 hover:text-red-400 transition-colors"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>
            ))
          )}
        </div>

        {items.length > 0 && (
          <DialogFooter className="p-8 border-t border-[#5A3F73]/20 bg-[#3D2852]/30 flex flex-col gap-6 sm:flex-col">
            <div className="flex items-center justify-between w-full px-2">
              <span className="text-sm text-white/40 uppercase tracking-[0.2em] font-bold">Subtotal Actual</span>
              <span className="text-4xl font-black text-white">${cartTotal.toFixed(2)}</span>
            </div>
            
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4 w-full">
              <button 
                onClick={() => setIsCartOpen(false)}
                className="w-full bg-[#5A3F73] hover:bg-[#4A3362] text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all shadow-xl flex items-center justify-center gap-2"
              >
                Confirmar Cambios <ShoppingBag className="w-4 h-4" />
              </button>
              
              <Link href="/shop" onClick={() => setIsCartOpen(false)}>
                <button 
                  className="w-full bg-transparent border-2 border-[#5A3F73]/40 text-[#5A3F73] hover:bg-[#5A3F73] hover:text-white py-5 rounded-2xl font-black text-xs uppercase tracking-widest transition-all flex items-center justify-center gap-2"
                >
                  <ArrowLeft className="w-4 h-4" /> Añadir otro producto
                </button>
              </Link>
            </div>

            <button 
              onClick={() => {
                clearCart();
                setIsCartOpen(false);
                window.location.href = "/";
              }}
              className="w-full mt-6 bg-red-500 hover:bg-red-600 text-white rounded-2xl py-4 font-black text-[10px] uppercase tracking-widest transition-all shadow-lg flex items-center justify-center gap-2 border-2 border-red-400/20"
            >
              <X className="w-4 h-4" /> Eliminar pedido actual
            </button>
          </DialogFooter>
        )}
      </DialogContent>
    </Dialog>
  );
}
