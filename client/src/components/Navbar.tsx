import "./navbar.css";
import { Link, useLocation } from "wouter";
import { cn } from "@/lib/utils";
import { lazy, Suspense, useEffect, useState } from "react";
import { Logo } from "@/components/Logo";
import { useCart } from "@/context/CartContext";

const SearchOverlay = lazy(() =>
  import("@/components/SearchOverlay").then((module) => ({ default: module.SearchOverlay })),
);

function IconMenu({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M4 7h16M4 12h16M4 17h16" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconClose({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path d="M6 6l12 12M18 6L6 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
    </svg>
  );
}

function IconSearch({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <circle cx="11" cy="11" r="7" stroke="currentColor" strokeWidth="2" />
      <path d="M20 20l-3.5-3.5" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconBag({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={className} aria-hidden="true">
      <path
        d="M6 9h12l-1 10a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2L6 9Z"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinejoin="round"
      />
      <path d="M9 9V7a3 3 0 1 1 6 0v2" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

function IconSpinner({ className }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" fill="none" className={cn("animate-spin", className)} aria-hidden="true">
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeWidth="2" opacity="0.25" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2" strokeLinecap="round" />
    </svg>
  );
}

export function Navbar() {
  const [location, setLocation] = useLocation();
  const [isOpen, setIsOpen] = useState(false);
  const [isSearchOpen, setIsSearchOpen] = useState(false);
  const [isCartNavigating, setIsCartNavigating] = useState(false);
  const { cartItemCount } = useCart();

  useEffect(() => {
    setIsOpen(false);
    setIsSearchOpen(false);
    setIsCartNavigating(false);
  }, [location]);

  const handleCartNavigation = () => {
    if (isCartNavigating || location === "/checkout") return;
    setIsCartNavigating(true);
    setLocation("/checkout");
  };

  const navPhrase = "Realiza tu pedido floral en Guayaquil y sorprende hoy";
  const rightLinks = [
    { href: "/#catalogo", label: "Catálogo" },
    { href: "/#contacto", label: "Contacto" },
  ];

  return (
    <>
      <Suspense fallback={null}>
        {isSearchOpen && <SearchOverlay isOpen={isSearchOpen} onClose={() => setIsSearchOpen(false)} />}
      </Suspense>

      <nav className="site-nav">
        <div className="site-nav-shell">
          <div className="site-nav-desktop">
            <div className="site-nav-desktop-left">
              <a href="/#catalogo" className="site-nav-phrase">
                {navPhrase}
              </a>
            </div>

            <div className="site-nav-brand-wrap">
              <Link href="/" className="site-nav-brand-link" aria-label="Ir al inicio de DIFIORI">
                <Logo
                  size="md"
                  variant="dark"
                  className="site-nav-brand-logo"
                />
              </Link>
            </div>

            <div className="site-nav-desktop-right">
              {rightLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className={cn("site-nav-link site-nav-link-desktop-only", "text-foreground hover:text-accent")}
                >
                  {link.label}
                  <span className={cn("site-nav-link-line", "bg-accent/40")} />
                </a>
              ))}

              <div className="site-nav-actions">
                <button
                  type="button"
                  aria-label="Buscar productos"
                  onClick={() => setIsSearchOpen(true)}
                  className={cn("site-nav-icon-button", "text-foreground hover:text-accent")}
                >
                  <IconSearch className="h-6 w-6 min-[1440px]:h-7 min-[1440px]:w-7" />
                </button>
                <button
                  type="button"
                  aria-label={`Ver carrito (${cartItemCount})`}
                  onClick={handleCartNavigation}
                  disabled={isCartNavigating}
                  className={cn("site-nav-cart-button", "text-foreground hover:text-accent")}
                >
                  {isCartNavigating ? (
                    <IconSpinner className="h-6 w-6 min-[1440px]:h-7 min-[1440px]:w-7" />
                  ) : (
                    <IconBag className="h-6 w-6 min-[1440px]:h-7 min-[1440px]:w-7" />
                  )}
                  <span className="translate-y-[2px] text-xs font-black tracking-widest min-[1440px]:text-sm">({cartItemCount})</span>
                </button>
              </div>
            </div>
          </div>

          <div className="site-nav-mobile">
            <button
              type="button"
              aria-label="Abrir menú"
              className={cn("site-nav-mobile-icon", "text-foreground")}
              onClick={() => setIsOpen(!isOpen)}
            >
              <IconMenu className="h-7 w-7 sm:h-8 sm:w-8" />
            </button>

            <div className="site-nav-mobile-brand">
              <Link href="/" className="site-nav-mobile-brand-link" aria-label="Ir al inicio de DIFIORI">
                <Logo size="sm" variant="dark" className="w-full items-center" />
              </Link>
            </div>

            <div className="site-nav-mobile-actions">
              <button
                type="button"
                aria-label="Buscar productos"
                onClick={() => setIsSearchOpen(true)}
                className={cn("site-nav-mobile-icon", "text-foreground")}
              >
                <IconSearch className="h-6 w-6 sm:h-7 sm:w-7" />
              </button>
              <button
                type="button"
                aria-label={`Ver carrito (${cartItemCount})`}
                onClick={handleCartNavigation}
                disabled={isCartNavigating}
                className={cn(
                  "relative flex h-11 w-11 items-center justify-center rounded-full transition-colors hover:scale-110 disabled:pointer-events-none disabled:opacity-70 sm:h-12 sm:w-12",
                  "text-foreground",
                )}
              >
                {isCartNavigating ? (
                  <IconSpinner className="h-6 w-6 sm:h-7 sm:w-7" />
                ) : (
                  <IconBag className="h-6 w-6 sm:h-7 sm:w-7" />
                )}
                {cartItemCount > 0 && !isCartNavigating ? (
                  <span className="absolute right-0 top-0 flex h-4 min-w-4 -translate-y-1 translate-x-1 items-center justify-center rounded-full border-2 border-[#fff] bg-accent px-1 text-[9px] font-black leading-none text-white shadow-lg sm:h-5 sm:min-w-5 sm:text-[10px]">
                    {cartItemCount}
                  </span>
                ) : null}
              </button>
            </div>
          </div>
        </div>

        {isOpen ? (
          <div className="mobile-menu-enter site-nav-mobile-menu">
            <div className="site-nav-mobile-menu-head">
              <Logo size="sm" variant="dark" />
              <button
                type="button"
                aria-label="Cerrar menú"
                className="site-nav-mobile-menu-close"
                onClick={() => setIsOpen(false)}
              >
                <IconClose className="h-6 w-6" />
              </button>
            </div>

            <div className="site-nav-mobile-menu-links">
              <a
                href="/#catalogo"
                className="site-nav-mobile-menu-phrase"
                onClick={() => setIsOpen(false)}
              >
                {navPhrase}
              </a>
              {rightLinks.map((link) => (
                <a
                  key={link.label}
                  href={link.href}
                  className="site-nav-mobile-menu-link"
                  onClick={() => setIsOpen(false)}
                >
                  {link.label}
                </a>
              ))}
            </div>
          </div>
        ) : null}
      </nav>
    </>
  );
}
