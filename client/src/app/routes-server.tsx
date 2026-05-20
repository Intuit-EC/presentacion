import { Switch, Route } from "wouter";
import Home from "@/pages/Home";
import Shop from "@/pages/Shop";
import CategoryPage from "@/pages/CategoryPage";
import SeoLandingPage from "@/pages/SeoLandingPage";
import NotFound from "@/pages/not-found";
import ProductDetails from "@/pages/ProductDetails";
import Checkout from "@/pages/Checkout";
import PaymentGateway from "@/pages/PaymentGateway";
import PaymentResult from "@/pages/PaymentResult";

export function ServerRoutes() {
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
