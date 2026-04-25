"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Banner,
  BlockStack,
  Box,
  DropZone,
  Icon,
  InlineStack,
  Modal,
  Pagination,
  Spinner,
  Text,
  TextField,
} from "@shopify/polaris";
import { FileIcon, PlayIcon, SearchIcon } from "@shopify/polaris-icons";

import { listMedia, uploadMedia, type MediaItem } from "@/lib/api/media";
import styles from "./media-picker-dialog.module.css";

type MediaPickerDialogProps = {
  open: boolean;
  selectedUrl?: string | null;
  onClose: () => void;
  onSelect: (item: MediaItem) => void;
};

const LIMIT = 24;

function detectKind(item: MediaItem): "image" | "video" | "file" {
  const type = (item.fileType ?? "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "file";
}

export function MediaPickerDialog({
  open,
  selectedUrl,
  onClose,
  onSelect,
}: MediaPickerDialogProps) {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [items, setItems] = useState<MediaItem[]>([]);
  const [totalPages, setTotalPages] = useState(1);
  const [selected, setSelected] = useState<MediaItem | null>(null);

  useEffect(() => {
    if (!open) return;
    const timeout = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 220);
    return () => clearTimeout(timeout);
  }, [open, search]);

  useEffect(() => {
    if (!open) return;
    const load = async () => {
      setLoading(true);
      setError(null);
      try {
        const response = await listMedia({
          page,
          limit: LIMIT,
          search: debouncedSearch,
        });
        setItems(response.data);
        setTotalPages(Math.max(1, response.meta.totalPages || 1));
      } catch (loadError) {
        setError(
          loadError instanceof Error
            ? loadError.message
            : "Impossible de charger la mediatheque."
        );
      } finally {
        setLoading(false);
      }
    };
    void load();
  }, [debouncedSearch, open, page]);

  useEffect(() => {
    if (!open) return;
    if (!selectedUrl) {
      setSelected(null);
      return;
    }
    const found = items.find((item) => item.url === selectedUrl) ?? null;
    setSelected(found);
  }, [items, open, selectedUrl]);

  const selectedId = useMemo(() => selected?.id ?? null, [selected?.id]);

  const uploadFromPicker = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setError(null);
    setSuccess(null);
    let latestUploaded: MediaItem | null = null;

    const results = await Promise.allSettled(
      acceptedFiles.map((file) => uploadMedia({ file }))
    );
    const fulfilled = results.filter(
      (r): r is PromiseFulfilledResult<MediaItem> => r.status === "fulfilled"
    );
    const rejected = results.filter(
      (r): r is PromiseRejectedResult => r.status === "rejected"
    );

    if (fulfilled.length > 0) {
      latestUploaded = fulfilled[fulfilled.length - 1].value;
      setSuccess(
        rejected.length > 0
          ? `${fulfilled.length} fichier(s) televerse(s), ${rejected.length} echec(s).`
          : `${fulfilled.length} fichier(s) televerse(s) avec succes.`
      );
    }
    if (rejected.length > 0) {
      const firstError = rejected[0].reason;
      setError(
        firstError instanceof Error
          ? firstError.message
          : "Certains fichiers n'ont pas pu etre televerses."
      );
    }

    try {
      const response = await listMedia({
        page: 1,
        limit: LIMIT,
        search: debouncedSearch,
      });
      setPage(1);
      setItems(response.data);
      setTotalPages(Math.max(1, response.meta.totalPages || 1));
      if (latestUploaded) {
        const matched =
          response.data.find((item) => item.id === latestUploaded?.id) ??
          latestUploaded;
        setSelected(matched);
      }
    } catch (refreshError) {
      setError(
        refreshError instanceof Error
          ? refreshError.message
          : "Impossible d'actualiser les medias."
      );
    } finally {
      setUploading(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Choisir un media"
      primaryAction={{
        content: "Utiliser ce media",
        disabled: !selected,
        onAction: () => {
          if (!selected) return;
          onSelect(selected);
        },
      }}
      secondaryActions={[{ content: "Annuler", onAction: onClose }]}
      size="large"
    >
      <Modal.Section>
        <BlockStack gap="300">
          <DropZone
            type="file"
            allowMultiple
            accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
            onDrop={(_, acceptedFiles) => {
              void uploadFromPicker(acceptedFiles);
            }}
            disabled={uploading}
          >
            <DropZone.FileUpload
              actionTitle={uploading ? "Televersement..." : "Televerser des fichiers"}
              actionHint="Glissez-deposez ou cliquez pour ajouter"
            />
          </DropZone>

          <TextField
            label="Recherche"
            value={search}
            onChange={setSearch}
            autoComplete="off"
            placeholder="Nom, description..."
            prefix={<Icon source={SearchIcon} />}
          />
          {error ? <Banner tone="critical" title={error} /> : null}
          {success ? <Banner tone="success" title={success} /> : null}

          {loading ? (
            <Box padding="400">
              <InlineStack align="center">
                <Spinner accessibilityLabel="Chargement des medias" />
              </InlineStack>
            </Box>
          ) : items.length === 0 ? (
            <Text as="p" tone="subdued">
              Aucun media trouve.
            </Text>
          ) : (
            <div className={styles.grid}>
              {items.map((item) => {
                const kind = detectKind(item);
                const selectedCard = selectedId === item.id;

                return (
                  <button
                    key={item.id}
                    type="button"
                    className={`${styles.cardButton} ${
                      selectedCard ? styles.cardButtonSelected : ""
                    }`}
                    onClick={() => setSelected(item)}
                  >
                    {kind === "image" ? (
                      // eslint-disable-next-line @next/next/no-img-element
                      <img
                        src={item.url}
                        alt={item.altText ?? item.name}
                        className={styles.preview}
                        loading="lazy"
                      />
                    ) : (
                      <Box
                        minHeight="120px"
                        background="bg-surface-secondary"
                        borderColor="border"
                      >
                        <InlineStack align="center" blockAlign="center">
                          <Box padding="400">
                            <Icon source={kind === "video" ? PlayIcon : FileIcon} />
                          </Box>
                        </InlineStack>
                      </Box>
                    )}
                    <div className={styles.meta}>
                      <Text as="p" variant="bodySm" fontWeight="medium">
                        <span className={styles.name}>{item.name}</span>
                      </Text>
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <InlineStack align="end">
            <Pagination
              type="table"
              hasPrevious={page > 1}
              hasNext={page < totalPages}
              onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() => setPage((prev) => Math.min(totalPages, prev + 1))}
            />
          </InlineStack>
        </BlockStack>
      </Modal.Section>
    </Modal>
  );
}
