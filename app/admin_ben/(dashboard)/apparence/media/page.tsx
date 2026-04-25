"use client";

import { useEffect, useMemo, useState } from "react";
import {
  Badge,
  Banner,
  BlockStack,
  Box,
  Button,
  Card,
  Divider,
  DropZone,
  Icon,
  InlineStack,
  Modal,
  Pagination,
  ProgressBar,
  Spinner,
  Text,
  TextField,
  Tooltip,
} from "@shopify/polaris";
import {
  DeleteIcon,
  FileIcon,
  ImageIcon,
  PlayIcon,
  RefreshIcon,
  SearchIcon,
  ViewIcon,
} from "@shopify/polaris-icons";

import {
  deleteMedia,
  getMediaUploadProgress,
  listMedia,
  uploadMedia,
  type MediaItem,
  type MediaListResponse,
} from "@/lib/api/media";
import styles from "./media.module.css";

type FileViewMode = "all" | "image" | "video" | "file";

const TYPE_OPTIONS = [
  { label: "Tous", value: "all" },
  { label: "Images", value: "image" },
  { label: "Videos", value: "video" },
  { label: "Fichiers", value: "file" },
];

const LIMIT = 24;

function formatBytes(size?: number) {
  if (!size || size <= 0) return "-";
  const units = ["B", "KB", "MB", "GB"];
  let value = size;
  let idx = 0;
  while (value >= 1024 && idx < units.length - 1) {
    value /= 1024;
    idx += 1;
  }
  return `${value.toFixed(value >= 10 || idx === 0 ? 0 : 1)} ${units[idx]}`;
}

function detectKind(item: MediaItem): Exclude<FileViewMode, "all"> {
  const type = (item.fileType ?? "").toLowerCase();
  if (type.startsWith("image/")) return "image";
  if (type.startsWith("video/")) return "video";
  return "file";
}

function createUploadId() {
  if (typeof crypto !== "undefined" && typeof crypto.randomUUID === "function") {
    return crypto.randomUUID();
  }
  return `upload-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export default function AdminMediaPage() {
  const [search, setSearch] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [filterMode, setFilterMode] = useState<FileViewMode>("all");
  const [page, setPage] = useState(1);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState(0);
  const [uploadStatusText, setUploadStatusText] = useState<string | null>(null);
  const [itemToDelete, setItemToDelete] = useState<MediaItem | null>(null);
  const [deleting, setDeleting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);
  const [response, setResponse] = useState<MediaListResponse>({
    data: [],
    meta: {
      total: 0,
      page: 1,
      limit: LIMIT,
      totalPages: 1,
      hasNextPage: false,
      hasPreviousPage: false,
    },
  });

  useEffect(() => {
    const timeout = setTimeout(() => {
      setPage(1);
      setDebouncedSearch(search.trim());
    }, 250);
    return () => clearTimeout(timeout);
  }, [search]);

  const loadMedia = async (targetPage = page) => {
    setLoading(true);
    setError(null);
    try {
      const data = await listMedia({
        page: targetPage,
        limit: LIMIT,
        search: debouncedSearch,
      });
      setResponse(data);
    } catch (loadError) {
      setError(
        loadError instanceof Error
          ? loadError.message
          : "Impossible de charger les medias."
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    void loadMedia(page);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [page, debouncedSearch]);

  const visibleItems = useMemo(() => {
    if (filterMode === "all") return response.data;
    return response.data.filter((item) => detectKind(item) === filterMode);
  }, [filterMode, response.data]);

  const counts = useMemo(() => {
    const all = response.data.length;
    let images = 0;
    let videos = 0;
    let files = 0;
    for (const item of response.data) {
      const kind = detectKind(item);
      if (kind === "image") images += 1;
      else if (kind === "video") videos += 1;
      else files += 1;
    }
    return { all, images, videos, files };
  }, [response.data]);

  const uploadFiles = async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return;
    setUploading(true);
    setUploadProgress(0);
    setUploadStatusText(`0 / ${acceptedFiles.length}`);
    setError(null);
    setSuccess(null);

    const totalBytes = acceptedFiles.reduce(
      (sum, file) => sum + Math.max(file.size, 1),
      0
    );
    let doneBytes = 0;
    let okCount = 0;
    let failCount = 0;
    let firstError: unknown = null;

    for (let index = 0; index < acceptedFiles.length; index += 1) {
      const file = acceptedFiles[index];
      const fileSize = Math.max(file.size, 1);
      const uploadId = createUploadId();
      setUploadStatusText(`${index + 1} / ${acceptedFiles.length} - ${file.name}`);

      let keepPolling = true;
      const pollBackendProgress = async () => {
        while (keepPolling) {
          try {
            const backendState = await getMediaUploadProgress(uploadId);
            const backendFilePercent = Math.min(
              100,
              Math.max(0, Math.round(backendState.progress))
            );
            const globalPercent = Math.round(
              ((doneBytes + (backendFilePercent / 100) * fileSize) / totalBytes) * 100
            );
            setUploadProgress(Math.min(100, Math.max(0, globalPercent)));
            setUploadStatusText(
              `${index + 1} / ${acceptedFiles.length} - ${backendState.message}`
            );

            if (backendState.status === "failed") {
              throw new Error(backendState.error ?? backendState.message);
            }
            if (backendState.status === "completed") {
              break;
            }
          } catch {
            // Ignore transient polling errors (e.g. progress not yet created).
          }
          await new Promise((resolve) => setTimeout(resolve, 250));
        }
      };

      const pollTask = pollBackendProgress();

      try {
        await uploadMedia({ file }, { uploadId, fileSize });
        okCount += 1;
      } catch (uploadError) {
        failCount += 1;
        firstError ??= uploadError;
      } finally {
        keepPolling = false;
        await pollTask;
        doneBytes += fileSize;
        setUploadProgress(Math.round((doneBytes / totalBytes) * 100));
      }
    }

    if (okCount > 0) {
      setSuccess(
        failCount > 0
          ? `${okCount} fichier(s) televerse(s), ${failCount} echec(s).`
          : `${okCount} fichier(s) televerse(s) avec succes.`
      );
    }

    if (failCount > 0) {
      setError(
        firstError instanceof Error
          ? firstError.message
          : "Certains fichiers n'ont pas pu etre televerses."
      );
    }

    setUploadProgress(100);
    setUploadStatusText("Televersement termine");
    setUploading(false);
    await loadMedia(1);
    setPage(1);
    setTimeout(() => {
      setUploadProgress(0);
      setUploadStatusText(null);
    }, 900);
  };

  const handleDelete = async (item: MediaItem) => {
    setDeleting(true);
    setError(null);
    setSuccess(null);
    try {
      await deleteMedia(item.path);
      setSuccess("Fichier supprime.");
      await loadMedia(page);
      setItemToDelete(null);
    } catch (deleteError) {
      setError(
        deleteError instanceof Error
          ? deleteError.message
          : "Impossible de supprimer ce fichier."
      );
    } finally {
      setDeleting(false);
    }
  };

  return (
    <BlockStack gap="400">
      <Card>
        <BlockStack gap="200">
          <InlineStack align="space-between" blockAlign="center">
            <BlockStack gap="100">
              <Text as="h2" variant="headingLg">
                Bibliotheque media
              </Text>
              <Text as="p" tone="subdued">
                Televersez et gerez vos images, videos et fichiers depuis votre stockage media.
              </Text>
            </BlockStack>
            <InlineStack gap="200">
              <Badge tone="info">{`Total page: ${counts.all}`}</Badge>
              <Badge tone="success">{`Images: ${counts.images}`}</Badge>
              <Badge tone="attention">{`Videos: ${counts.videos}`}</Badge>
            </InlineStack>
          </InlineStack>
          <Divider />
          <div className={styles.panel}>
            <DropZone
              type="file"
              allowMultiple
              accept="image/*,video/*,.pdf,.doc,.docx,.xls,.xlsx,.csv,.txt,.zip"
              onDrop={(_, acceptedFiles) => {
                void uploadFiles(acceptedFiles);
              }}
              disabled={uploading}
            >
              <div className={styles.dropZone}>
                <DropZone.FileUpload
                  actionTitle={
                    uploading
                      ? `Televersement en cours... ${uploadProgress}%`
                      : "Ajouter des fichiers"
                  }
                  actionHint="Glissez-deposez ici ou cliquez pour choisir"
                />
              </div>
            </DropZone>
            {uploading ? (
              <Box paddingBlockStart="300">
                <BlockStack gap="200">
                  <InlineStack align="space-between">
                    <Text as="p" tone="subdued">
                      {uploadStatusText ?? "Televersement..."}
                    </Text>
                    <Text as="p" variant="bodyMd" fontWeight="medium">
                      {`${uploadProgress}%`}
                    </Text>
                  </InlineStack>
                  <ProgressBar progress={uploadProgress} tone="highlight" size="small" />
                </BlockStack>
              </Box>
            ) : null}
          </div>
        </BlockStack>
      </Card>

      {error ? <Banner tone="critical" title={error} /> : null}
      {success ? <Banner tone="success" title={success} /> : null}

      <Card>
        <BlockStack gap="300">
          <InlineStack align="space-between" blockAlign="end" gap="200">
            <Box minWidth="300px" width="55%">
              <TextField
                label="Rechercher un media"
                value={search}
                onChange={setSearch}
                autoComplete="off"
                prefix={<Icon source={SearchIcon} />}
                placeholder="Nom, description..."
              />
            </Box>
            <InlineStack gap="200">
              {TYPE_OPTIONS.map((option) => (
                <Button
                  key={option.value}
                  variant={filterMode === option.value ? "primary" : "secondary"}
                  onClick={() => setFilterMode(option.value as FileViewMode)}
                >
                  {option.label}
                </Button>
              ))}
              <Button
                icon={RefreshIcon}
                onClick={() => {
                  void loadMedia(page);
                }}
              >
                Actualiser
              </Button>
            </InlineStack>
          </InlineStack>

          {loading ? (
            <Box padding="600">
              <InlineStack align="center">
                <Spinner accessibilityLabel="Chargement des medias" size="large" />
              </InlineStack>
            </Box>
          ) : visibleItems.length === 0 ? (
            <Box padding="500">
              <BlockStack gap="200">
                <Text as="p" tone="subdued">
                  Aucun media trouve.
                </Text>
                <Text as="p" tone="subdued">
                  Ajoutez vos fichiers via la zone de televersement ci-dessus.
                </Text>
              </BlockStack>
            </Box>
          ) : (
            <div className={styles.grid}>
              {visibleItems.map((item) => {
                const kind = detectKind(item);
                const isImage = kind === "image";
                return (
                  <article key={item.id} className={styles.mediaCard}>
                    <div className={styles.mediaPreview}>
                      {isImage ? (
                        // eslint-disable-next-line @next/next/no-img-element
                        <img
                          src={item.url}
                          alt={item.altText ?? item.name}
                          className={styles.thumb}
                          loading="lazy"
                        />
                      ) : (
                        <Icon source={kind === "video" ? PlayIcon : FileIcon} tone="subdued" />
                      )}
                    </div>
                    <div className={styles.meta}>
                      <BlockStack gap="100">
                        <Text as="p" variant="bodyMd" fontWeight="medium">
                          <span className={styles.filename}>{item.name}</span>
                        </Text>
                        <InlineStack gap="100">
                          <Badge icon={kind === "image" ? ImageIcon : kind === "video" ? PlayIcon : FileIcon}>
                            {kind === "image" ? "Image" : kind === "video" ? "Video" : "Fichier"}
                          </Badge>
                          <Text as="span" variant="bodySm" tone="subdued">
                            {formatBytes(item.fileSize)}
                          </Text>
                        </InlineStack>
                        <Text as="p" variant="bodySm" tone="subdued">
                          <span className={styles.subline}>{item.path}</span>
                        </Text>
                      </BlockStack>
                      <div className={styles.actions}>
                        <Tooltip content="Ouvrir">
                          <Button
                            icon={ViewIcon}
                            url={item.url}
                            external
                            target="_blank"
                            accessibilityLabel="Ouvrir le media"
                          />
                        </Tooltip>
                        <Tooltip content="Supprimer">
                          <Button
                            icon={DeleteIcon}
                            tone="critical"
                            accessibilityLabel="Supprimer le media"
                            onClick={() => {
                              setItemToDelete(item);
                            }}
                          />
                        </Tooltip>
                      </div>
                    </div>
                  </article>
                );
              })}
            </div>
          )}

          <InlineStack align="space-between" blockAlign="center">
            <Text as="p" tone="subdued">
              {`Page ${response.meta.page} / ${Math.max(response.meta.totalPages, 1)} - ${response.meta.total} media(s)`}
            </Text>
            <Pagination
              type="table"
              hasPrevious={response.meta.hasPreviousPage}
              hasNext={response.meta.hasNextPage}
              onPrevious={() => setPage((prev) => Math.max(1, prev - 1))}
              onNext={() =>
                setPage((prev) =>
                  response.meta.totalPages > 0
                    ? Math.min(response.meta.totalPages, prev + 1)
                    : prev + 1
                )
              }
            />
          </InlineStack>
        </BlockStack>
      </Card>

      <Modal
        open={Boolean(itemToDelete)}
        onClose={() => {
          if (!deleting) {
            setItemToDelete(null);
          }
        }}
        title="Supprimer le fichier"
        primaryAction={
          itemToDelete
            ? {
                content: "Supprimer",
                destructive: true,
                loading: deleting,
                onAction: () => {
                  void handleDelete(itemToDelete);
                },
              }
            : undefined
        }
        secondaryActions={[
          {
            content: "Annuler",
            disabled: deleting,
            onAction: () => setItemToDelete(null),
          },
        ]}
      >
        <Modal.Section>
          <Text as="p">
            {itemToDelete
              ? `Voulez-vous vraiment supprimer "${itemToDelete.name}" ?`
              : ""}
          </Text>
        </Modal.Section>
      </Modal>
    </BlockStack>
  );
}

