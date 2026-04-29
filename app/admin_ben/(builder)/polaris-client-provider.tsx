"use client";

import { AppProvider } from "@shopify/polaris";
import en from "@shopify/polaris/locales/en.json";

export function PolarisClientProvider({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return <AppProvider i18n={en}>{children}</AppProvider>;
}
