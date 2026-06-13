import * as React from "react";
import { useNavigate } from "react-router";
import {
  IconDashboard,
  IconDiscount,
  IconInnerShadowTop,
  IconPackage,
  IconShoppingCart,
  IconTag,
  IconHome,
  IconAppWindow,
  IconCreditCard,
  IconBell,
  IconChartBar,
} from "@tabler/icons-react";


import { NavMain } from "@/shared/components/layout/nav-main";
import { NavUser } from "@/shared/components/layout/nav-user";
import {
  Sidebar,
  SidebarContent,
  SidebarFooter,
  SidebarHeader,
  SidebarMenu,
  SidebarMenuButton,
  SidebarMenuItem,
} from "@/shared/components/ui/sidebar";
import { useUserStore } from "@/store/use-user-store";
import { NavModules } from "./nav-modules";
// import { useUserStore } from "@/store/use-user-store"

function resolveFeatureIcon(name: string) {
  if (name.includes("discounts")) return IconDiscount;

  // fallback
  return IconDashboard;
}

const navItems = {
  options: [
    {
      title: "Dashboard",
      url: "/app/dashboard",
      icon: IconDashboard,
    },
    {
      title: "Productos",
      url: "/app/products",
      icon: IconPackage,
    },
    {
      title: "Pedidos",
      url: "/app/orders",
      icon: IconShoppingCart,
    },
    {
      title: "Reportes",
      url: "/app/reports",
      icon: IconChartBar,
    },
    {
      title: "Pagos",
      url: "/app/payments",
      icon: IconCreditCard,
    },
    {
      title: "Carritos Abandonados",
      url: "/app/abandoned-carts",
      icon: IconBell,
    },
    {
      title: "Cupones",
      url: "/app/coupons",
      icon: IconTag,
    },
  ],
  // Agregaremos esto para el modulo cms para el sitio web
  modules: [
    {
      title: "Personalizar Sitio Web",
      url: "/app/cms",
      icon: IconAppWindow,
      isActive: false,
      items: [
        {
          title: "Principal",
          url: "/app/cms/home",
          icon: IconHome,
        },
      ],
    },
  ],
};

export function AppSidebar({ ...props }: React.ComponentProps<typeof Sidebar>) {
  const { features } = useUserStore();
  const navigate = useNavigate();

  const dynamicNavItems = features.map((f) => ({
    title: f.display_name,
    url: `/app/${f.name}`, // Ej: /app/products
    icon: resolveFeatureIcon(f.name),
  }));

  // const allNavItems = [...navItems, ...dynamicNavItems];
  // Deduplicar opciones para evitar el error de key "Productos"
  const filteredDynamicItems = dynamicNavItems.filter(
    (d) => !navItems.options.some((s) => s.title.toLowerCase() === d.title.toLowerCase())
  );

  const allNavItems = {
    options: [...navItems.options, ...filteredDynamicItems],
    modules: [...navItems.modules],
  };

  return (
    <Sidebar collapsible="offcanvas" {...props}>
      <SidebarHeader>
        <SidebarMenu>
          <SidebarMenuItem>
            <SidebarMenuButton
              className="data-[slot=sidebar-menu-button]:!p-1.5"
              onClick={() => navigate("/app/dashboard")}
            >
              <span className="flex items-center gap-2">
                <IconInnerShadowTop className="!size-5" />
                <span className="text-base font-semibold">Administrador</span>
              </span>
            </SidebarMenuButton>
          </SidebarMenuItem>
        </SidebarMenu>
      </SidebarHeader>
      <SidebarContent>
        <NavMain items={allNavItems.options} />
        <NavModules items={allNavItems.modules} />
        {/* <NavDocuments items={data.documents} />
        <NavSecondary items={data.navSecondary} className="mt-auto" /> */}
      </SidebarContent>
      <SidebarFooter>
        <NavUser />
      </SidebarFooter>
    </Sidebar>
  );
}
