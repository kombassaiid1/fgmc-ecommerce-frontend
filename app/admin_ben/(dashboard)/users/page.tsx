"use client";

import { useCallback, useEffect, useState } from "react";
import { BlockStack, Tabs, Text } from "@shopify/polaris";
import { listAdminRoles, type AdminRoleItem } from "@/lib/api/admin-access";
import { RolesTab } from "./roles-tab";
import { UsersTab } from "./users-tab";

const TABS = [
  { id: "users", content: "Utilisateurs" },
  { id: "roles", content: "Rôles et permissions" },
];

export default function AdminUsersPage() {
  const [selected, setSelected] = useState(0);
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);

  const refreshRoles = useCallback(() => {
    listAdminRoles()
      .then(setRoles)
      .catch(() => setRoles([]));
  }, []);

  useEffect(() => {
    refreshRoles();
  }, [refreshRoles]);

  return (
    <BlockStack gap="300">
      <Text as="h2" variant="headingLg">
        Utilisateurs
      </Text>
      <Tabs tabs={TABS} selected={selected} onSelect={setSelected} />
      {selected === 0 ? <UsersTab roles={roles} /> : <RolesTab onChanged={refreshRoles} />}
    </BlockStack>
  );
}
