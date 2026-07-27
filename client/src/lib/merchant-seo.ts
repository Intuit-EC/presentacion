import { DEFAULT_COMPANY, absoluteUrl, canonicalUrl } from "@/lib/site";

export const MERCHANT_ORGANIZATION_ID = `${canonicalUrl("/")}#organization`;
export const MERCHANT_SHIPPING_ID = `${canonicalUrl("/")}#shipping-policy`;
export const MERCHANT_RETURN_POLICY_ID = `${canonicalUrl("/")}#return-policy`;

export function getMerchantShippingServiceSchema() {
  return {
    "@type": "ShippingService",
    "@id": MERCHANT_SHIPPING_ID,
    name: "Entrega local DIFIORI en Guayaquil",
    description: "Entrega coordinada de flores, arreglos florales y regalos dentro de Guayaquil. El costo y horario se confirman según sector antes del despacho.",
    fulfillmentType: "https://schema.org/FulfillmentTypeDelivery",
    shippingConditions: {
      "@type": "ShippingConditions",
      shippingDestination: {
        "@type": "DefinedRegion",
        addressCountry: "EC",
        addressRegion: "Guayas",
        addressLocality: DEFAULT_COMPANY.city,
      },
      transitTime: {
        "@type": "ServicePeriod",
        duration: {
          "@type": "QuantitativeValue",
          minValue: 0,
          maxValue: 1,
          unitCode: "DAY",
        },
        businessDays: ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"],
      },
    },
  };
}

export function getMerchantReturnPolicySchema() {
  return {
    "@type": "MerchantReturnPolicy",
    "@id": MERCHANT_RETURN_POLICY_ID,
    name: "Política de cambios y cancelaciones DIFIORI",
    applicableCountry: "EC",
    returnPolicyCategory: "https://schema.org/MerchantReturnNotPermitted",
    description: "Por tratarse de productos florales y personalizados, los cambios o cancelaciones se coordinan con el equipo DIFIORI antes de la preparación y despacho.",
  };
}

export function getMerchantOrganizationSchema() {
  return {
    "@type": "Florist",
    "@id": MERCHANT_ORGANIZATION_ID,
    name: DEFAULT_COMPANY.name,
    url: canonicalUrl("/"),
    image: absoluteUrl("/opengraph.jpg"),
    logo: absoluteUrl("/difiori-favicon-192.png"),
    telephone: `+${DEFAULT_COMPANY.phoneDigits}`,
    email: DEFAULT_COMPANY.email,
    priceRange: "$$",
    description: "DIFIORI ofrece flores frescas, ramos de flores, arreglos florales y regalos a domicilio en Guayaquil con atención personalizada y pagos seguros.",
    address: {
      "@type": "PostalAddress",
      addressLocality: DEFAULT_COMPANY.city,
      addressRegion: "Guayas",
      addressCountry: "EC",
    },
    areaServed: {
      "@type": "City",
      name: DEFAULT_COMPANY.city,
      address: {
        "@type": "PostalAddress",
        addressCountry: "EC",
      },
    },
    paymentAccepted: "Cash, Credit Card, Bank Transfer, PayPal, Zelle",
    currenciesAccepted: "USD",
    hasShippingService: getMerchantShippingServiceSchema(),
    hasMerchantReturnPolicy: getMerchantReturnPolicySchema(),
  };
}

export function getOfferShippingDetailsSchema() {
  return {
    "@type": "OfferShippingDetails",
    shippingDestination: {
      "@type": "DefinedRegion",
      addressCountry: "EC",
      addressRegion: "Guayas",
      addressLocality: DEFAULT_COMPANY.city,
    },
    deliveryTime: {
      "@type": "ShippingDeliveryTime",
      handlingTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 1,
        unitCode: "DAY",
      },
      transitTime: {
        "@type": "QuantitativeValue",
        minValue: 0,
        maxValue: 1,
        unitCode: "DAY",
      },
    },
  };
}
