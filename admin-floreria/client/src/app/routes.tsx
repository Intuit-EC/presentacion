import ProtectRoutes from "@/core/guards/protect-routes";
import Loading from "@/shared/components/loading";
import { useUserStore } from "@/store/use-user-store";
import { lazy, Suspense } from "react";
import { Navigate, useRoutes } from "react-router";
import { featureComponentMap } from "./feature-component-map";

const CouponsList = lazy(() => import("@/features/modules/loyalty/coupons/pages/CouponsList"));
const CouponForm = lazy(() => import("@/features/modules/loyalty/coupons/pages/CouponForm"));
const CouponDetail = lazy(() => import("@/features/modules/loyalty/coupons/pages/CouponDetail"));

const AuthPage = lazy(() => import("@/features/auth/pages/auth-page"));
const AdminDashboard = lazy(
  () => import("@/features/dashboard/pages/dashboard-page")
);
const OrdersPage = lazy(() => import("@/features/orders/pages/order-page"));
const ReportsPage = lazy(() => import("@/features/reports/pages/reports-page"));
const PaymentsPage = lazy(() => import("@/features/payments/pages/payments-page"));
const AbandonedCartsPage = lazy(
  () => import("@/features/abandoned-carts/pages/abandoned-carts-page")
);
const ProductsPage = lazy(
  () => import("@/features/products/pages/product-page")
);
const Home = lazy(() => import("@/features/home/pages/home"));
const SideBar = lazy(() => import("@/shared/components/layout"));

// Promotions pages
const PromotionsList = lazy(() => import("@/features/promotions/pages/PromotionsList"));
const PromotionForm = lazy(() => import("@/features/promotions/pages/PromotionForm"));

// CMS pages
const CmsHomeDashboard = lazy(() => import("@/features/modules/cms/pages/CmsHomeDashboard"));

// Loyalty pages
// const LoyaltyDashboard = lazy(() => import("@/features/modules/loyalty/dashboard/LoyaltyDashboard"));
// const SegmentsList = lazy(() => import("@/features/modules/loyalty/segments/pages/SegmentsList"));
// const SegmentForm = lazy(() => import("@/features/modules/loyalty/segments/pages/SegmentForm"));
// const SegmentDetail = lazy(() => import("@/features/modules/loyalty/segments/pages/SegmentDetail"));
// const CouponsList = lazy(() => import("@/features/modules/loyalty/coupons/pages/CouponsList"));
// const CouponForm = lazy(() => import("@/features/modules/loyalty/coupons/pages/CouponForm"));
// const CouponDetail = lazy(() => import("@/features/modules/loyalty/coupons/pages/CouponDetail"));
// const CampaignsList = lazy(() => import("@/features/modules/loyalty/campaigns/pages/CampaignsList"));
// const CampaignForm = lazy(() => import("@/features/modules/loyalty/campaigns/pages/CampaignForm"));
// const CampaignDetail = lazy(() => import("@/features/modules/loyalty/campaigns/pages/CampaignDetail"));
// const TemplatesList = lazy(() => import("@/features/modules/loyalty/templates/pages/TemplatesList"));
// const TemplateForm = lazy(() => import("@/features/modules/loyalty/templates/pages/TemplateForm"));
// const TemplateDetail = lazy(() => import("@/features/modules/loyalty/templates/pages/TemplateDetail"));
// const AutomationsList = lazy(() => import("@/features/modules/loyalty/automations/pages/AutomationsList"));
// const AutomationForm = lazy(() => import("@/features/modules/loyalty/automations/pages/AutomationForm"));
// const AutomationDetail = lazy(() => import("@/features/modules/loyalty/automations/pages/AutomationDetail"));

function buildFeatureRoutes() {
  const { features } = useUserStore.getState();

  return features.flatMap(f => {
    const Component = featureComponentMap[f.name];
    if (!Component) return []; // ← no null, sino array vacío -

    return [{
      path: f.name,
      element: (
        <Suspense fallback={<Loading />}>
          <Component />
        </Suspense>
      )
    }];
  });
}

export default function Routes() {
  return useRoutes([
    {
      path: "/",
      element: (
        <Suspense fallback={<Loading />}>
          <Home />
        </Suspense>
      ),
    },
    {
      path: "/auth",
      element: (
        <Suspense fallback={<Loading />}>
          <AuthPage />
        </Suspense>
      ),
    },
    {
      path: "/app",
      element: (
        <ProtectRoutes>
          <Suspense fallback={<Loading />}>
            <SideBar />
          </Suspense>
        </ProtectRoutes>
      ),
      children: [
        {
          index: true,
          element: <Navigate to="dashboard" replace />,
        },
        {
          path: "dashboard",
          element: (
            <Suspense fallback={<Loading />}>
              <AdminDashboard />
            </Suspense>
          ),
        },
        {
          path: "products",
          element: (
            <Suspense fallback={<Loading />}>
              <ProductsPage />
            </Suspense>
          ),
        },
        {
          path: "orders",
          element: (
            <Suspense fallback={<Loading />}>
              <OrdersPage />
            </Suspense>
          ),
        },
        {
          path: "reports",
          element: (
            <Suspense fallback={<Loading />}>
              <ReportsPage />
            </Suspense>
          ),
        },
        {
          path: "payments",
          element: (
            <Suspense fallback={<Loading />}>
              <PaymentsPage />
            </Suspense>
          ),
        },
        {
          path: "abandoned-carts",
          element: (
            <Suspense fallback={<Loading />}>
              <AbandonedCartsPage />
            </Suspense>
          ),
        },
        ...buildFeatureRoutes(),
        {
          path: "coupons",
          children: [
            {
              path: "",
              element: (
                <Suspense fallback={<Loading />}>
                  <CouponsList />
                </Suspense>
              ),
            },
            {
              path: "new",
              element: (
                <Suspense fallback={<Loading />}>
                  <CouponForm />
                </Suspense>
              ),
            },
            {
              path: ":id",
              element: (
                <Suspense fallback={<Loading />}>
                  <CouponDetail />
                </Suspense>
              ),
            },
            {
              path: ":id/edit",
              element: (
                <Suspense fallback={<Loading />}>
                  <CouponForm />
                </Suspense>
              ),
            },
          ],
        },
        {
          path: "promotions",
          children: [
            {
              path: "",
              element: (
                <Suspense fallback={<Loading />}>
                  <PromotionsList />
                </Suspense>
              ),
            },
            {
              path: "new",
              element: (
                <Suspense fallback={<Loading />}>
                  <PromotionForm />
                </Suspense>
              ),
            },
            {
              path: ":id",
              element: (
                <Suspense fallback={<Loading />}>
                  <PromotionForm />
                </Suspense>
              ),
            },
          ],
        },
        {
          path: "cms",
          children: [
            {
              path: "home",
              element: (
                <Suspense fallback={<Loading />}>
                  <CmsHomeDashboard />
                </Suspense>
              ),
            },
          ],
        }
      ],
    },
  ]);
}
