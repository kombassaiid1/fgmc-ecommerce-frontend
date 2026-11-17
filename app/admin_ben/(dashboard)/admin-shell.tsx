/* eslint-disable @typescript-eslint/no-explicit-any */
"use client";

import Link from "next/link";
import { forwardRef, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import {
  AppProvider,
  Box,
  Card,
  Frame,
  Navigation,
  Page,
  TopBar,
} from "@shopify/polaris";
import {
  AppsIcon,
  ColorIcon,
  DeliveryIcon,
  GlobeIcon,
  HomeIcon,
  ImageIcon,
  MenuHorizontalIcon,
  OrderIcon,
  PersonIcon,
  ProductIcon,
  SettingsIcon,
  StarIcon,
} from "@shopify/polaris-icons";
import en from "@shopify/polaris/locales/en.json";

import type { AdminUser } from "@/lib/admin-auth";
import { AdminSessionContext } from "@/components/admin/admin-session";
import { can, permissionForPath } from "@/lib/permissions";
import Image from "next/image";
import { AgentFloatingButton } from "@/components/agent/agent-floating-button";
import { AgentAdminNavigationContext } from "@/components/agent/agent-admin-navigation-context";

type AdminShellProps = {
  children: React.ReactNode;
  user: AdminUser;
};

type PolarisLinkProps = {
  url?: string;
  children?: React.ReactNode;
  external?: boolean;
  target?: string;
  onClick?: () => void;
  [key: string]: any;
};

const PolarisNextLink = forwardRef<HTMLAnchorElement, PolarisLinkProps>(
  function PolarisNextLink({ url, external, children, ...rest }, ref) {
    const href = typeof url === "string" ? url : "#";

    if (external || href.startsWith("http")) {
      return (
        <a href={href} ref={ref} {...rest}>
          {children}
        </a>
      );
    }

    return (
      <Link href={href} ref={ref} {...rest}>
        {children}
      </Link>
    );
  },
);

const NAV_ITEMS = [
  {
    label: "Tableau de bord",
    url: "/admin_ben",
    icon: HomeIcon,
    exactMatch: true,
    permission: "dashboard.view",
  },
  {
    label: "Produits",
    url: "/admin_ben/products",
    icon: ProductIcon,
    permission: "products.view",
    subNavigationItems: [
      { label: "Categories", url: "/admin_ben/products/categories" },
      { label: "Attributs", url: "/admin_ben/products/attributs" },
      { label: "Marques", url: "/admin_ben/products/marques" },
    ],
  },
  {
    label: "Apparence",
    url: "/admin_ben/apparence",
    icon: ColorIcon,
    permission: "appearance.view",
    subNavigationItems: [
      { label: "Header", url: "/admin_ben/apparence/header", icon: MenuHorizontalIcon },
      { label: "Accueil & hero", url: "/admin_ben/apparence/hero", icon: ImageIcon },
      { label: "Media", url: "/admin_ben/apparence/media", icon: ImageIcon },
      { label: "Page builder", url: "/admin_ben/page-builder", icon: AppsIcon },
    ],
  },
  { label: "Commandes", url: "/admin_ben/orders", icon: OrderIcon, permission: "orders.view" },
  {
    label: "Livraison",
    url: "/admin_ben/livraison",
    icon: DeliveryIcon,
    permission: "settings.view",
    subNavigationItems: [
      { label: "Transporteurs", url: "/admin_ben/livraison/transporteurs" },
      { label: "Préférences", url: "/admin_ben/livraison/preferences" },
      { label: "Poids des produits", url: "/admin_ben/livraison/poids" },
    ],
  },
  {
    label: "International",
    url: "/admin_ben/international",
    icon: GlobeIcon,
    permission: "settings.view",
    subNavigationItems: [
      { label: "Localisation", url: "/admin_ben/international/localisation" },
      { label: "Zones géographiques", url: "/admin_ben/international/zones" },
      { label: "Taxes", url: "/admin_ben/international/taxes" },
      { label: "Traductions", url: "/admin_ben/international/traductions" },
    ],
  },
  { label: "Modules", url: "/admin_ben/modules", icon: AppsIcon, permission: "modules.view" },
  { label: "Avis clients", url: "/admin_ben/reviews", icon: StarIcon, permission: "reviews.view" },
  { label: "Clients", url: "/admin_ben/clients", icon: PersonIcon, permission: "clients.view" },
  { label: "Utilisateurs", url: "/admin_ben/users", icon: PersonIcon, permission: "users.view" },
  {
    label: "Parametres",
    url: "/admin_ben/settings",
    icon: SettingsIcon,
    permission: "settings.view",
    subNavigationItems: [
      { label: "Couleurs des statuts", url: "/admin_ben/settings/order-status-colors" },
      { label: "Paramètres produit", url: "/admin_ben/settings/products" },
    ],
  },
];

export function AdminShell({ children, user }: AdminShellProps) {
  const pathname = usePathname();
  const isAgentPage = pathname === "/admin_ben/agent";
  const [showMobileNavigation, setShowMobileNavigation] = useState(false);
  const [showAgentAdminMenu, setShowAgentAdminMenu] = useState(true);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const displayName =
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.username?.trim() ||
    user.email;

  const permissions = useMemo(() => user.permissions ?? [], [user.permissions]);
  const requiredPermission = permissionForPath(pathname);
  const hasAccess = can(permissions, requiredPermission);

  const navigationMarkup = useMemo(
    () => (
      <Navigation location={pathname}>
        <Navigation.Section
          title="Menu administration"
          items={NAV_ITEMS.filter((item) => can(permissions, item.permission)).map(
            ({ permission: _permission, ...item }) => ({
              ...item,
              onClick: () => setShowMobileNavigation(false),
            }),
          )}
        />
      </Navigation>
    ),
    [pathname, permissions],
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle={!isAgentPage}
      onNavigationToggle={() => setShowMobileNavigation((prev) => !prev)}
      userMenu={
        <TopBar.UserMenu
          name={displayName}
          detail={user.email}
          initials={displayName
            .split(" ")
            .filter(Boolean)
            .slice(0, 2)
            .map((part) => part[0]?.toUpperCase() ?? "")
            .join("")}
          open={isUserMenuOpen}
          onToggle={() => setIsUserMenuOpen((prev) => !prev)}
          actions={[
            {
              items: [
                {
                  content: "Se deconnecter",
                  onAction: () => {
                    window.location.assign("/admin_ben/logout");
                  },
                },
              ],
            },
          ]}
        />
      }
      contextControl={
        <Box paddingInlineStart="300">
          <Image alt="logo" src="/logo-black.png" width={150} height={40} />
        </Box>
      }
    />
  );

  return (
    <AppProvider i18n={en} linkComponent={PolarisNextLink}>
      <AdminSessionContext.Provider value={{ userId: user.id, permissions }}>
      <AgentAdminNavigationContext.Provider
        value={{
          isVisible: showAgentAdminMenu,
          toggle: () => setShowAgentAdminMenu((visible) => !visible),
        }}
      >
        <Frame
          topBar={topBarMarkup}
          navigation={isAgentPage && !showAgentAdminMenu ? undefined : navigationMarkup}
          showMobileNavigation={showMobileNavigation}
          onNavigationDismiss={() => setShowMobileNavigation(false)}>
          {!hasAccess ? (
            <Page>
              <Card roundedAbove="sm">
                <div role="alert" className="py-8 text-center">
                  <h2 className="text-lg font-semibold">Accès refusé</h2>
                  <p className="mt-1 text-sm text-slate-600">
                    Votre rôle ne vous autorise pas à accéder à cette section.
                  </p>
                </div>
              </Card>
            </Page>
          ) : pathname === "/admin_ben/agent" ? (
            <div className="px-4 py-3">{children}</div>
          ) : (
            <Page>
              <Card roundedAbove="sm">{children}</Card>
            </Page>
          )}
        </Frame>
      </AgentAdminNavigationContext.Provider>
      {pathname !== "/admin_ben/agent" && hasAccess && can(permissions, "agent.view") && <AgentFloatingButton />}
      </AdminSessionContext.Provider>
    </AppProvider>
  );
}
