"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  IndexTable,
  InlineGrid,
  InlineStack,
  Modal,
  Pagination,
  Select,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAdminSession } from "@/components/admin/admin-session";
import {
  createStaffUser,
  deleteStaffUser,
  listStaffUsers,
  updateStaffUser,
  type AdminRoleItem,
  type StaffRole,
  type StaffUser,
} from "@/lib/api/admin-access";

type Draft = {
  id?: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  username: string;
  phoneNumber: string;
  role: StaffRole;
  adminRoleId: string;
};

const EMPTY_DRAFT: Draft = {
  email: "",
  password: "",
  firstName: "",
  lastName: "",
  username: "",
  phoneNumber: "",
  role: "STORE_MANAGER",
  adminRoleId: "",
};

function displayName(user: StaffUser) {
  return `${user.firstName ?? ""} ${user.lastName ?? ""}`.trim() || user.username || user.email;
}

export function UsersTab({ roles }: { roles: AdminRoleItem[] }) {
  const { can, userId } = useAdminSession();
  const canEdit = can("users.edit");
  const [users, setUsers] = useState<StaffUser[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<StaffUser | null>(null);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedSearch(search);
      setPage(1);
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await listStaffUsers({ page, search: debouncedSearch });
      setUsers(result.data);
      setTotalPages(Math.max(1, result.meta.totalPages));
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, [page, debouncedSearch]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = async () => {
    if (!draft) return;
    if (!draft.email.trim() || (!draft.id && draft.password.length < 6)) {
      setError("L'e-mail et un mot de passe de 6 caractères minimum sont obligatoires.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const common = {
        email: draft.email.trim(),
        firstName: draft.firstName.trim() || undefined,
        lastName: draft.lastName.trim() || undefined,
        username: draft.username.trim() || undefined,
        phoneNumber: draft.phoneNumber.trim() || undefined,
        role: draft.role,
        adminRoleId: draft.role === "ADMIN" ? null : draft.adminRoleId || null,
      };
      if (draft.id) {
        await updateStaffUser(draft.id, {
          ...common,
          ...(draft.password ? { password: draft.password } : {}),
        });
      } else {
        await createStaffUser({ ...common, password: draft.password });
      }
      setDraft(null);
      await load();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteStaffUser(toDelete.id);
      setToDelete(null);
      await load();
    } catch (deleteError) {
      setToDelete(null);
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    }
  };

  const roleOptions = [
    { label: "Par défaut (tout sauf utilisateurs)", value: "" },
    ...roles.map((role) => ({ label: role.name, value: role.id })),
  ];

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between" blockAlign="end" gap="300">
        <div style={{ minWidth: 260, flex: "1 1 260px", maxWidth: 420 }}>
          <TextField
            label="Rechercher"
            labelHidden
            placeholder="Nom, e-mail ou identifiant"
            value={search}
            onChange={setSearch}
            autoComplete="off"
            clearButton
            onClearButtonClick={() => setSearch("")}
          />
        </div>
        {canEdit ? (
          <Button variant="primary" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            Nouvel utilisateur
          </Button>
        ) : null}
      </InlineStack>

      {error && !draft ? <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner> : null}

      {loading ? (
        <Spinner accessibilityLabel="Chargement" />
      ) : (
        <IndexTable
          resourceName={{ singular: "utilisateur", plural: "utilisateurs" }}
          itemCount={users.length}
          selectable={false}
          headings={[
            { title: "Utilisateur" },
            { title: "Type" },
            { title: "Rôle / permissions" },
            { title: "Actions", alignment: "end" },
          ]}>
          {users.map((user, index) => (
            <IndexTable.Row id={user.id} key={user.id} position={index}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold">{displayName(user)}</Text>
                <Text as="p" variant="bodySm" tone="subdued">{user.email}</Text>
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge tone={user.role === "ADMIN" ? "success" : "info"}>
                  {user.role === "ADMIN" ? "Administrateur" : "Gestionnaire"}
                </Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>
                {user.role === "ADMIN"
                  ? "Tous les droits"
                  : user.adminRole?.name ?? "Par défaut"}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <InlineStack align="end" gap="200">
                  {canEdit ? (
                    <>
                      <Button
                        size="slim"
                        onClick={() =>
                          setDraft({
                            id: user.id,
                            email: user.email,
                            password: "",
                            firstName: user.firstName ?? "",
                            lastName: user.lastName ?? "",
                            username: user.username ?? "",
                            phoneNumber: user.phoneNumber ?? "",
                            role: user.role,
                            adminRoleId: user.adminRoleId ?? "",
                          })
                        }>
                        Modifier
                      </Button>
                      <Button
                        size="slim"
                        tone="critical"
                        disabled={user.id === userId}
                        onClick={() => setToDelete(user)}>
                        Supprimer
                      </Button>
                    </>
                  ) : null}
                </InlineStack>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      )}

      {totalPages > 1 ? (
        <InlineStack align="center">
          <Pagination
            hasPrevious={page > 1}
            hasNext={page < totalPages}
            onPrevious={() => setPage((p) => p - 1)}
            onNext={() => setPage((p) => p + 1)}
          />
        </InlineStack>
      ) : null}

      <Modal
        open={draft !== null}
        title={draft?.id ? "Modifier l'utilisateur" : "Nouvel utilisateur"}
        onClose={() => !saving && setDraft(null)}
        primaryAction={{ content: "Enregistrer", loading: saving, onAction: () => void save() }}
        secondaryActions={[{ content: "Annuler", onAction: () => setDraft(null), disabled: saving }]}>
        <Modal.Section>
          {draft ? (
            <BlockStack gap="300">
              {error ? <Banner tone="critical">{error}</Banner> : null}
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <TextField label="Prénom" value={draft.firstName} autoComplete="off"
                  onChange={(firstName) => setDraft({ ...draft, firstName })} />
                <TextField label="Nom" value={draft.lastName} autoComplete="off"
                  onChange={(lastName) => setDraft({ ...draft, lastName })} />
              </InlineGrid>
              <TextField label="E-mail" type="email" value={draft.email} autoComplete="off"
                onChange={(email) => setDraft({ ...draft, email })} />
              <InlineGrid columns={{ xs: 1, sm: 2 }} gap="300">
                <TextField label="Identifiant" value={draft.username} autoComplete="off"
                  onChange={(username) => setDraft({ ...draft, username })} />
                <TextField label="Téléphone" value={draft.phoneNumber} autoComplete="off"
                  onChange={(phoneNumber) => setDraft({ ...draft, phoneNumber })} />
              </InlineGrid>
              <TextField
                label={draft.id ? "Nouveau mot de passe" : "Mot de passe"}
                type="password"
                value={draft.password}
                autoComplete="new-password"
                helpText={draft.id ? "Laissez vide pour conserver le mot de passe actuel." : "6 caractères minimum."}
                onChange={(password) => setDraft({ ...draft, password })}
              />
              <Select
                label="Type de compte"
                options={[
                  { label: "Gestionnaire (permissions limitées)", value: "STORE_MANAGER" },
                  { label: "Administrateur (tous les droits)", value: "ADMIN" },
                ]}
                value={draft.role}
                disabled={draft.id === userId}
                onChange={(role) => setDraft({ ...draft, role: role as StaffRole })}
              />
              {draft.role === "STORE_MANAGER" ? (
                <Select
                  label="Rôle"
                  options={roleOptions}
                  value={draft.adminRoleId}
                  onChange={(adminRoleId) => setDraft({ ...draft, adminRoleId })}
                />
              ) : null}
            </BlockStack>
          ) : null}
        </Modal.Section>
      </Modal>

      <Modal
        open={toDelete !== null}
        title={`Supprimer ${toDelete ? displayName(toDelete) : ""} ?`}
        onClose={() => setToDelete(null)}
        primaryAction={{ content: "Supprimer", destructive: true, onAction: () => void remove() }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete(null) }]}>
        <Modal.Section>
          <Text as="p">Ce compte perdra immédiatement l&apos;accès à l&apos;administration.</Text>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
