"use client";

import { useCallback, useEffect, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Button,
  Checkbox,
  IndexTable,
  InlineStack,
  Modal,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { useAdminSession } from "@/components/admin/admin-session";
import {
  createAdminRole,
  deleteAdminRole,
  listAdminRoles,
  updateAdminRole,
  type AdminRoleItem,
} from "@/lib/api/admin-access";
import { PERMISSION_MODULES } from "@/lib/permissions";

type Draft = { id?: string; name: string; description: string; permissions: string[] };

const EMPTY_DRAFT: Draft = { name: "", description: "", permissions: ["dashboard.view"] };

const ACTION_LABELS = { view: "Voir", edit: "Modifier" } as const;

export function RolesTab({ onChanged }: { onChanged: () => void }) {
  const { can } = useAdminSession();
  const canEdit = can("users.edit");
  const [roles, setRoles] = useState<AdminRoleItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [draft, setDraft] = useState<Draft | null>(null);
  const [saving, setSaving] = useState(false);
  const [toDelete, setToDelete] = useState<AdminRoleItem | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setRoles(await listAdminRoles());
      setError(null);
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Chargement impossible.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  const togglePermission = (permission: string, checked: boolean) =>
    setDraft((current) => {
      if (!current) return current;
      const next = new Set(current.permissions);
      if (checked) {
        next.add(permission);
        // edit implies view
        if (permission.endsWith(".edit")) next.add(permission.replace(/\.edit$/, ".view"));
      } else {
        next.delete(permission);
        // removing view removes edit
        if (permission.endsWith(".view")) next.delete(permission.replace(/\.view$/, ".edit"));
      }
      return { ...current, permissions: [...next] };
    });

  const save = async () => {
    if (!draft) return;
    if (!draft.name.trim()) {
      setError("Le nom du rôle est obligatoire.");
      return;
    }
    setSaving(true);
    setError(null);
    try {
      const payload = {
        name: draft.name.trim(),
        description: draft.description.trim(),
        permissions: draft.permissions,
      };
      if (draft.id) await updateAdminRole(draft.id, payload);
      else await createAdminRole(payload);
      setDraft(null);
      await load();
      onChanged();
    } catch (saveError) {
      setError(saveError instanceof Error ? saveError.message : "Enregistrement impossible.");
    } finally {
      setSaving(false);
    }
  };

  const remove = async () => {
    if (!toDelete) return;
    try {
      await deleteAdminRole(toDelete.id);
      setToDelete(null);
      await load();
      onChanged();
    } catch (deleteError) {
      setToDelete(null);
      setError(deleteError instanceof Error ? deleteError.message : "Suppression impossible.");
    }
  };

  return (
    <BlockStack gap="300">
      <InlineStack align="space-between" blockAlign="center">
        <Text as="p" tone="subdued">
          Un rôle regroupe des permissions. Les administrateurs ont toujours tous les droits.
        </Text>
        {canEdit ? (
          <Button variant="primary" onClick={() => setDraft({ ...EMPTY_DRAFT })}>
            Nouveau rôle
          </Button>
        ) : null}
      </InlineStack>

      {error && !draft ? <Banner tone="critical" onDismiss={() => setError(null)}>{error}</Banner> : null}

      {loading ? (
        <Spinner accessibilityLabel="Chargement" />
      ) : (
        <IndexTable
          resourceName={{ singular: "rôle", plural: "rôles" }}
          itemCount={roles.length}
          selectable={false}
          headings={[
            { title: "Rôle" },
            { title: "Permissions" },
            { title: "Utilisateurs" },
            { title: "Actions", alignment: "end" },
          ]}>
          {roles.map((role, index) => (
            <IndexTable.Row id={role.id} key={role.id} position={index}>
              <IndexTable.Cell>
                <Text as="span" fontWeight="semibold">{role.name}</Text>
                {role.description ? (
                  <Text as="p" variant="bodySm" tone="subdued">{role.description}</Text>
                ) : null}
              </IndexTable.Cell>
              <IndexTable.Cell>
                <Badge>{`${role.permissions.length} permission${role.permissions.length > 1 ? "s" : ""}`}</Badge>
              </IndexTable.Cell>
              <IndexTable.Cell>{role._count?.users ?? 0}</IndexTable.Cell>
              <IndexTable.Cell>
                <InlineStack align="end" gap="200">
                  <Button
                    size="slim"
                    onClick={() =>
                      setDraft({
                        id: role.id,
                        name: role.name,
                        description: role.description ?? "",
                        permissions: role.permissions,
                      })
                    }>
                    {canEdit ? "Modifier" : "Voir"}
                  </Button>
                  {canEdit ? (
                    <Button size="slim" tone="critical" onClick={() => setToDelete(role)}>
                      Supprimer
                    </Button>
                  ) : null}
                </InlineStack>
              </IndexTable.Cell>
            </IndexTable.Row>
          ))}
        </IndexTable>
      )}

      <Modal
        open={draft !== null}
        size="large"
        title={draft?.id ? "Modifier le rôle" : "Nouveau rôle"}
        onClose={() => !saving && setDraft(null)}
        primaryAction={
          canEdit
            ? { content: "Enregistrer", loading: saving, onAction: () => void save() }
            : undefined
        }
        secondaryActions={[{ content: "Annuler", onAction: () => setDraft(null), disabled: saving }]}>
        <Modal.Section>
          {draft ? (
            <BlockStack gap="400">
              {error ? <Banner tone="critical">{error}</Banner> : null}
              <TextField
                label="Nom du rôle"
                value={draft.name}
                disabled={!canEdit}
                autoComplete="off"
                onChange={(name) => setDraft({ ...draft, name })}
              />
              <TextField
                label="Description"
                value={draft.description}
                disabled={!canEdit}
                autoComplete="off"
                onChange={(description) => setDraft({ ...draft, description })}
              />
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-left">
                    <tr>
                      <th className="px-4 py-2 font-semibold">Section</th>
                      <th className="px-4 py-2 font-semibold">{ACTION_LABELS.view}</th>
                      <th className="px-4 py-2 font-semibold">{ACTION_LABELS.edit}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {PERMISSION_MODULES.map((module) => (
                      <tr key={module.key}>
                        <td className="px-4 py-2">{module.label}</td>
                        {(["view", "edit"] as const).map((action) => {
                          const permission = `${module.key}.${action}`;
                          return (
                            <td key={action} className="px-4 py-2">
                              {module.actions.includes(action) ? (
                                <Checkbox
                                  label={`${ACTION_LABELS[action]} ${module.label}`}
                                  labelHidden
                                  disabled={!canEdit}
                                  checked={draft.permissions.includes(permission)}
                                  onChange={(checked) => togglePermission(permission, checked)}
                                />
                              ) : (
                                <span className="text-slate-300">—</span>
                              )}
                            </td>
                          );
                        })}
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </BlockStack>
          ) : null}
        </Modal.Section>
      </Modal>

      <Modal
        open={toDelete !== null}
        title={`Supprimer le rôle « ${toDelete?.name ?? ""} » ?`}
        onClose={() => setToDelete(null)}
        primaryAction={{ content: "Supprimer", destructive: true, onAction: () => void remove() }}
        secondaryActions={[{ content: "Annuler", onAction: () => setToDelete(null) }]}>
        <Modal.Section>
          <Text as="p">Cette action est irréversible.</Text>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}
