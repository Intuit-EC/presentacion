import { DEFAULT_COMPANY } from "@/lib/site";

export function FloatingWhatsApp() {
  return (
    <a
      href={`https://wa.me/${DEFAULT_COMPANY.phoneDigits}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="Contactar por WhatsApp"
      className="fixed bottom-5 right-4 z-[120] inline-flex h-14 w-14 items-center justify-center rounded-full border border-white/35 bg-[#25d366] text-white shadow-[0_18px_38px_rgba(37,211,102,0.38)] ring-4 ring-[#25d366]/15 transition hover:bg-[#1ebe5d] hover:shadow-[0_22px_44px_rgba(37,211,102,0.42)] sm:bottom-8 sm:right-8 sm:h-auto sm:w-auto sm:min-h-[64px] sm:max-w-[calc(100vw-2rem)] sm:gap-3 sm:px-5"
    >
      <svg
        viewBox="0 0 24 24"
        className="h-8 w-8 shrink-0 drop-shadow-lg sm:h-9 sm:w-9"
        xmlns="http://www.w3.org/2000/svg"
        aria-hidden="true"
      >
        <path
          fill="white"
          d="M12.031 0C5.39 0 0 5.385 0 12.028a11.96 11.96 0 001.597 6.036L0 24l6.117-1.605a11.968 11.968 0 005.918 1.564c6.64 0 12.03-5.388 12.03-12.031C24.065 5.385 18.671 0 12.031 0z"
        />
        <path
          fill="#25D366"
          d="M17.362 14.156c-.292-.146-1.728-.853-1.996-.95-.264-.097-.456-.145-.648.145-.192.29-.74.922-.907 1.114-.167.19-.334.213-.626.067-.282-.143-1.222-.45-2.328-1.435-.86-.767-1.437-1.716-1.606-2.008-.168-.291-.018-.45.126-.595.13-.133.292-.34.437-.51.144-.17.191-.291.286-.485.096-.194.048-.363-.024-.51-.07-.145-.648-1.562-.888-2.14-.23-.559-.47-.48-.648-.49-.168-.008-.36-.01-.55-.01s-.51.074-.77.345c-.26.29-1 .976-1 2.428s1.026 2.85 1.17 3.045c.145.195 2.02 3.084 4.89 4.33.682.296 1.215.474 1.63.606.69.219 1.317.187 1.815.113.553-.081 1.73-.705 1.972-1.385.242-.68.242-1.262.17-1.385-.078-.124-.282-.195-.572-.34z"
        />
      </svg>
      <span className="hidden sm:flex sm:flex-col sm:text-left sm:leading-none">
        <span className="text-xs font-black uppercase tracking-[0.12em] text-white/95">
          Pedir por
        </span>
        <span className="mt-1 text-base font-black text-white">
          WhatsApp
        </span>
      </span>
    </a>
  );
}
