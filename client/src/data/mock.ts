export const ADMIN_CREDENTIALS = {
  username: "admin",
  password: "password123"
};

export interface Product {
  id: string;
  name: string;
  description: string;
  category: string;
  price: string;
  image: string;
  additionalImages?: string[];
  isBestSeller: boolean;
  /** Posición elegida en el panel. Nulo si aún no se ha ordenado a mano. */
  sortOrder?: number | null;
  stock: number;
  deliveryTime: string;
  size: string;
  includes: string;
}

export const CATEGORIES = [
  { 
    name: "Ramos de rosas", 
    slug: "ramos-de-rosas", 
    image: "/assets/product1.png" 
  },
  { 
    name: "Flores mixtas", 
    slug: "flores-mixtas", 
    image: "/assets/banner_collage.webp" 
  },
  { 
    name: "Desayunos sorpresa", 
    slug: "desayunos-sorpresa", 
    image: "/assets/Desayunos sorpresa para aniversario, con minitorta  en Guayaquil..jpeg" 
  },
  { 
    name: "Regalos con vino", 
    slug: "regalos-con-vino", 
    image: "/assets/banner_collage.webp" 
  },
  { 
    name: "Cumpleaños", 
    slug: "cumpleanos", 
    image: "/assets/Ramo de rosas con rosas rosadas para 15 años en Guayaquil.jpeg" 
  },
  { 
    name: "Amor y aniversario", 
    slug: "amor-y-aniversario", 
    image: "/assets/Ramo de flores para aniversario, con rosas rojas, vino, ferrero , en Guayaquil..jpeg" 
  }
];

export const INITIAL_PRODUCTS: Product[] = [
  {
    id: "1",
    name: "Ramo de Rosas Rojas Premium",
    description: "Elegante ramo de 24 rosas rojas frescas de exportación, envueltas en papel decorativo y lazo de seda. Ideal para expresar amor profundo.",
    category: "Ramos de rosas",
    price: "$45.00",
    image: "/assets/product1.png",
    additionalImages: ["/assets/product1.png"],
    isBestSeller: true,
    stock: 15,
    deliveryTime: "2-3 horas",
    size: "50cm x 35cm",
    includes: "24 Rosas rojas de exportación, tarjeta de dedicatoria, papel decorativo y lazo."
  },
  {
    id: "2",
    name: "Arreglo Primaveral Mixto",
    description: "Combinación vibrante de lirios, margaritas y claveles en tonos pasteles. Una explosión de frescura para cualquier ocasión.",
    category: "Flores mixtas",
    price: "$38.00",
    image: "/assets/banner_collage.webp",
    additionalImages: ["/assets/banner_collage.webp"],
    isBestSeller: true,
    stock: 12,
    deliveryTime: "2-4 horas",
    size: "40cm x 30cm",
    includes: "Lirios, margaritas, claveles, follaje seco y florero de vidrio."
  },
  {
    id: "3",
    name: "Cesta Sorpresa Gourmet",
    description: "Completo desayuno que incluye café premium, croissants recién horneados, ensalada de frutas frescas, jugo de naranja y un mini bouquet decorativo.",
    category: "Desayunos sorpresa",
    price: "$55.00",
    image: "/assets/Desayunos sorpresa para aniversario, con minitorta  en Guayaquil..jpeg",
    additionalImages: [
      "/assets/Desayunos sorpresa para aniversario, con minitorta  en Guayaquil..jpeg",
      "/assets/Desayuno sorpresa con flores para aniversario en Guayaquil.jpeg",
      "/assets/banner_collage.webp",
    ],
    isBestSeller: true,
    stock: 8,
    deliveryTime: "En la mañana (6am - 10am)",
    size: "Cesta Estándar",
    includes: "Café, 2 croissants, ensalada de frutas, jugo natural, mini arreglo floral."
  },
  {
    id: "4",
    name: "Caja de Rosas Bouquet Royal",
    description: "Caja de lujo con 12 rosas seleccionadas y follaje decorativo. Un regalo sofisticado y duradero.",
    category: "Amor y aniversario",
    price: "$32.00",
    image: "/assets/Ramo de flores para aniversario, con rosas rojas, vino, ferrero , en Guayaquil..jpeg",
    additionalImages: [
      "/assets/Ramo de flores para aniversario, con rosas rojas, vino, ferrero , en Guayaquil..jpeg",
      "/assets/banner_collage.webp",
    ],
    isBestSeller: false,
    stock: 20,
    deliveryTime: "2-3 horas",
    size: "25cm x 25cm",
    includes: "12 Rosas seleccionadas, caja de lujo cuadrada, lazo de raso."
  },
  {
    id: "5",
    name: "Vino & Flores Selection",
    description: "Caja de regalo que incluye una botella de vino tinto Cabernet Sauvignon y un pequeño arreglo de flores complementario.",
    category: "Regalos con vino",
    price: "$65.00",
    image: "/assets/banner_collage.webp",
    additionalImages: ["/assets/banner_collage.webp"],
    isBestSeller: false,
    stock: 5,
    deliveryTime: "3-5 horas",
    size: "Caja de Regalo Grande",
    includes: "Vino Cabernet Sauvignon 750ml, arreglo floral lateral, caja rígida decorada."
  },
  {
    id: "6",
    name: "Bouquet Cumpleaños Alegre",
    description: "Arreglo colorido con globos metalizados y flores mixtas. La mejor forma de desear un feliz día.",
    category: "Cumpleaños",
    price: "$40.00",
    image: "/assets/Ramo de rosas con rosas rosadas para 15 años en Guayaquil.jpeg",
    additionalImages: [
      "/assets/Ramo de rosas con rosas rosadas para 15 años en Guayaquil.jpeg",
      "/assets/banner_collage.webp",
    ],
    isBestSeller: false,
    stock: 10,
    deliveryTime: "2-4 horas",
    size: "45cm x 35cm",
    includes: "Flores mixtas brillantes, globo metálico con helio, envoltura festiva."
  }
];


export const SALES_DATA = [
  { month: "Ene", sales: 8500 },
  { month: "Feb", sales: 15200 },
  { month: "Mar", sales: 9800 },
  { month: "Abr", sales: 11100 },
  { month: "May", sales: 18900 },
  { month: "Jun", sales: 10500 },
];

export const TESTIMONIALS = [
  {
    name: "Stalin Espinoza",
    role: "Cliente",
    content: "Muchas Gracias. Felicitaciones, siguen teniendo un excelente servicio.",
    stars: 5
  },
  {
    name: "María Fernanda G.",
    role: "Cliente Frecuente",
    content: "Los mejores arreglos de Guayaquil. El servicio a domicilio es impecable.",
    stars: 5
  }
];

export const COMPANY_INFO = {
  description: "Florería en Guayaquil con entrega a domicilio en 2 horas en toda la ciudad. Arreglos florales, desayunos sorpresa y regalos para sorprender hoy mismo.",
  history: "DIFIORI: Diseñando emociones con flores frescas y exclusivas. La elegancia y el detalle son nuestra firma desde 2010.",
  frescura: "Frescura Garantizada: Flores seleccionadas y recién cortadas, listas para regalar.",
  personalizacion: "Regalos personalizados en Guayaquil: Asesoría profesional para que cada detalle sea único."
};

export const FAQS = [
  {
    question: "¿Tienen entrega inmediata?",
    answer: "Sí, entregamos en un rango de 2 horas en toda la ciudad de Guayaquil."
  },
  {
    question: "¿Cómo puedo cuidar mis flores?",
    answer: "Consulta nuestra guía de cuidado para que tus flores duren mucho más tiempo."
  },
  {
    question: "¿Aceptan pagos con tarjeta?",
    answer: "Aceptamos todas las tarjetas de crédito, transferencias y pagos por WhatsApp."
  }
];

export const CARE_GUIDE = [
  {
    step: "Corte los tallos",
    description: "Corte 2cm de los tallos en diagonal al recibir sus flores."
  },
  {
    step: "Agua fresca",
    description: "Cambie el agua del florero cada dos días y asegúrese de que esté limpia."
  },
  {
    step: "Ubicación ideal",
    description: "Mantenga las flores en un lugar fresco, lejos de la luz solar directa y corrientes de aire."
  }
];

export const CONTACT_DETAILS = {
  phone: "+(593) 099 7984 583",
  whatsapp: "+(593) 099 7984 583",
  email: "ventas@difiori.com.ec",
  address: "Guayaquil, Ecuador"
};

