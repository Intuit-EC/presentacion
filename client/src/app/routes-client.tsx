import { lazy } from "react";
import { Switch, Route } from "wouter";
import Home from "@/pages/Home";

const Shop = lazy(() => import("@/pages/Shop"));
const CategoryPage = lazy(() => import("@/pages/CategoryPage"));
const SeoLandingPage = lazy(() => import("@/pages/SeoLandingPage"));
const ProductDetails = lazy(() => import("@/pages/ProductDetails"));
const NotFound = lazy(() => import("@/pages/not-found"));
const Checkout = lazy(() => import("@/pages/Checkout"));
const PaymentGateway = lazy(() => import("@/pages/PaymentGateway"));
const PaymentResult = lazy(() => import("@/pages/PaymentResult"));

export function BrowserRoutes() {
  return (
    <Switch>
      <Route path="/" component={Home} />
      <Route path="/shop" component={Shop} />
      <Route path="/flores-guayaquil" component={SeoLandingPage} />
      <Route path="/floreria-guayaquil" component={SeoLandingPage} />
      <Route path="/florerias-en-guayaquil" component={SeoLandingPage} />
      <Route path="/ramos-de-flores" component={SeoLandingPage} />
      <Route path="/arreglos-de-flores-guayaquil" component={SeoLandingPage} />
      <Route path="/arreglos-florales-guayaquil" component={SeoLandingPage} />
      <Route path="/categoria/:slug" component={CategoryPage} />
      <Route path="/producto/:slug" component={ProductDetails} />
      <Route path="/product/:id" component={ProductDetails} />
      <Route path="/checkout" component={Checkout} />
      <Route path="/payment-gateway" component={PaymentGateway} />
      <Route path="/payment-result" component={PaymentResult} />
      <Route component={NotFound} />
    </Switch>
  );
}
