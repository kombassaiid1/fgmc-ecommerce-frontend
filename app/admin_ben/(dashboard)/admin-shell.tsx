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
  Text,
} from "@shopify/polaris";
import {
  ColorIcon,
  HomeIcon,
  ImageIcon,
  OrderIcon,
  PersonIcon,
  ProductIcon,
  SettingsIcon,
} from "@shopify/polaris-icons";
import en from "@shopify/polaris/locales/en.json";

import type { AdminUser } from "@/lib/admin-auth";
import Image from "next/image";

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
  },
  {
    label: "Produits",
    url: "/admin_ben/products",
    icon: ProductIcon,
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
    subNavigationItems: [
      { label: "Media", url: "/admin_ben/apparence/media", icon: ImageIcon },
    ],
  },
  { label: "Commandes", url: "/admin_ben/orders", icon: OrderIcon },
  { label: "Utilisateurs", url: "/admin_ben/users", icon: PersonIcon },
  { label: "Parametres", url: "/admin_ben/settings", icon: SettingsIcon },
];

export function AdminShell({ children, user }: AdminShellProps) {
  const pathname = usePathname();
  const [showMobileNavigation, setShowMobileNavigation] = useState(false);
  const [isUserMenuOpen, setIsUserMenuOpen] = useState(false);
  const displayName =
    `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() ||
    user.username?.trim() ||
    user.email;

  const navigationMarkup = useMemo(
    () => (
      <Navigation location={pathname}>
        <Navigation.Section
          title="Menu administration"
          items={NAV_ITEMS.map((item) => ({
            ...item,
            onClick: () => setShowMobileNavigation(false),
          }))}
        />
      </Navigation>
    ),
    [pathname],
  );

  const topBarMarkup = (
    <TopBar
      showNavigationToggle
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
      <Frame
        topBar={topBarMarkup}
        navigation={navigationMarkup}
        showMobileNavigation={showMobileNavigation}
        onNavigationDismiss={() => setShowMobileNavigation(false)}>
        <Page>
          <Card roundedAbove="sm">{children}</Card>
        </Page>
      </Frame>
    </AppProvider>
  );
}
