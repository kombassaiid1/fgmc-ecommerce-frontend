/** Shared (client + server) permission helpers. Keys mirror the backend catalog. */

export type PermissionModule = {
  key: string;
  label: string;
  actions: ReadonlyArray<"view" | "edit">;
};

export const PERMISSION_MODULES: ReadonlyArray<PermissionModule> = [
  { key: "dashboard", label: "Tableau de bord", actions: ["view"] },
  { key: "products", label: "Produits", actions: ["view", "edit"] },
  { key: "orders", label: "Commandes", actions: ["view", "edit"] },
  { key: "clients", label: "Clients", actions: ["view", "edit"] },
  { key: "reviews", label: "Avis clients", actions: ["view", "edit"] },
  { key: "appearance", label: "Apparence & page builder", actions: ["view", "edit"] },
  { key: "modules", label: "Modules & intégrations", actions: ["view", "edit"] },
  { key: "settings", label: "Paramètres", actions: ["view", "edit"] },
  { key: "agent", label: "Agent IA", actions: ["view"] },
  { key: "users", label: "Utilisateurs & rôles", actions: ["view", "edit"] },
  { key: "activity", label: "Journal d’activité", actions: ["view"] },
];

/** Longest matching prefix wins. */
const ROUTE_PERMISSIONS: Array<[prefix: string, permission: string]> = [
  ["/admin_ben/products", "products.view"],
  ["/admin_ben/orders", "orders.view"],
  ["/admin_ben/clients", "clients.view"],
  ["/admin_ben/messages", "clients.view"],
  ["/admin_ben/reviews", "reviews.view"],
  ["/admin_ben/apparence", "appearance.view"],
  ["/admin_ben/page-builder", "appearance.view"],
  ["/admin_ben/modules", "modules.view"],
  ["/admin_ben/livraison", "settings.view"],
  ["/admin_ben/international", "settings.view"],
  ["/admin_ben/settings", "settings.view"],
  ["/admin_ben/agent", "agent.view"],
  ["/admin_ben/users", "users.view"],
  ["/admin_ben/journal", "activity.view"],
];

export function permissionForPath(pathname: string): string | null {
  const match = ROUTE_PERMISSIONS.filter(
    ([prefix]) => pathname === prefix || pathname.startsWith(`${prefix}/`),
  ).sort((a, b) => b[0].length - a[0].length)[0];
  if (match) return match[1];
  return pathname === "/admin_ben" ? "dashboard.view" : null;
}

export function can(permissions: string[] | undefined, permission: string | null): boolean {
  if (!permission) return true;
  return (permissions ?? []).includes(permission);
}
