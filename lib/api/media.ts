import { getBackendBaseUrl } from "@/lib/backend-url";
import { ApiError, apiRequest } from "./http-client";

const API_BASE_URL = getBackendBaseUrl();

type MediaBasePath = "/media" | "/api/media" | "/v1/media" | "/api/v1/media";

let MEDIA_BASE_PATH: MediaBasePath = "/media";

export type MediaItem = {
  id: string;
  name: string;
  path: string;
  url: string;
  createdAt?: string;
  altText?: string | null;
  description?: string | null;
  fileType?: string;
  fileSize?: number;
};

export type MediaListResponse = {
  data: MediaItem[];
  meta: {
    total: number;
    page: number;
    limit: number;
    totalPages: number;
    hasNextPage: boolean;
    hasPreviousPage: boolean;
  };
};

type ListMediaParams = {
  page?: number;
  limit?: number;
  search?: string;
};

type UploadMediaPayload = {
  file: File;
  originalName?: string;
  altText?: string;
  description?: string;
};

type UploadProgress = {
  loaded: number;
  total: number;
  percentage: number;
};

type UploadMediaOptions = {
  onProgress?: (progress: UploadProgress) => void;
  uploadId?: string;
  fileSize?: number;
};

export type BackendUploadProgress = {
  uploadId: string;
  progress: number;
  status: "receiving" | "processing" | "completed" | "failed";
  message: string;
  updatedAt: number;
  error?: string;
};

function buildUploadCandidates(): Array<{
  url: string;
  basePath: MediaBasePath;
}> {
  const paths: MediaBasePath[] = [MEDIA_BASE_PATH];
  if (!paths.includes("/media")) paths.push("/media");
  if (!paths.includes("/api/media")) paths.push("/api/media");
  if (!paths.includes("/v1/media")) paths.push("/v1/media");
  if (!paths.includes("/api/v1/media")) paths.push("/api/v1/media");
  return paths.map((basePath) => ({
    basePath,
    url: `${API_BASE_URL}${basePath}/upload`,
  }));
}

async function mediaRequest<T>({
  pathSuffix,
  method,
}: {
  pathSuffix: string;
  method: "GET" | "DELETE";
}): Promise<T> {
  const candidates: MediaBasePath[] = [MEDIA_BASE_PATH];
  if (!candidates.includes("/media")) candidates.push("/media");
  if (!candidates.includes("/api/media")) candidates.push("/api/media");
  if (!candidates.includes("/v1/media")) candidates.push("/v1/media");
  if (!candidates.includes("/api/v1/media")) candidates.push("/api/v1/media");

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const result = await apiRequest<T>({
        path: `${candidate}${pathSuffix}`,
        method,
      });
      MEDIA_BASE_PATH = candidate;
      return result;
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw (lastError instanceof Error
    ? lastError
    : new ApiError("Media request failed.", 500));
}

export async function listMedia(
  params: ListMediaParams = {}
): Promise<MediaListResponse> {
  const query = new URLSearchParams();
  if (params.page) query.set("page", String(params.page));
  if (params.limit) query.set("limit", String(params.limit));
  if (params.search?.trim()) query.set("search", params.search.trim());
  const qs = query.toString();

  return mediaRequest<MediaListResponse>({
    pathSuffix: `${qs ? `?${qs}` : ""}`,
    method: "GET",
  });
}

export async function uploadMedia(
  payload: UploadMediaPayload,
  options?: UploadMediaOptions
): Promise<MediaItem> {
  const form = new FormData();
  form.append("file", payload.file);
  if (payload.originalName?.trim()) form.append("originalName", payload.originalName.trim());
  if (payload.altText?.trim()) form.append("altText", payload.altText.trim());
  if (payload.description?.trim()) form.append("description", payload.description.trim());

  if (typeof XMLHttpRequest === "undefined") {
    return apiRequest<MediaItem>({
      path: `${MEDIA_BASE_PATH}/upload`,
      method: "POST",
      body: form,
    });
  }

  const uploadWithUrl = (url: string) =>
    new Promise<MediaItem>((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.open("POST", url);
      if (options?.uploadId) xhr.setRequestHeader("x-upload-id", options.uploadId);
      if (options?.fileSize && Number.isFinite(options.fileSize)) {
        xhr.setRequestHeader("x-file-size", String(Math.max(1, options.fileSize)));
      }

      xhr.upload.onprogress = (event) => {
        if (!options?.onProgress) return;
        const total = event.lengthComputable
          ? event.total
          : payload.file.size || event.loaded || 1;
        const loaded = event.loaded;
        const percentage = Math.min(100, Math.max(0, Math.round((loaded / total) * 100)));
        options.onProgress({ loaded, total, percentage });
      };

      xhr.onload = () => {
        const status = xhr.status;
        let parsed: unknown = null;
        try {
          parsed = xhr.responseText ? JSON.parse(xhr.responseText) : null;
        } catch {
          parsed = null;
        }

        if (status >= 200 && status < 300) {
          resolve(parsed as MediaItem);
          return;
        }

        const payloadError = parsed as { message?: string | string[] } | null;
        const message = Array.isArray(payloadError?.message)
          ? payloadError.message.join(", ")
          : payloadError?.message ?? "Upload echoue.";
        reject(new ApiError(message, status || 500));
      };

      xhr.onerror = () => reject(new ApiError("Erreur reseau pendant le televersement.", 0));
      xhr.onabort = () => reject(new ApiError("Televersement annule.", 0));
      xhr.send(form);
    });

  const candidates = buildUploadCandidates();
  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const result = await uploadWithUrl(candidate.url);
      MEDIA_BASE_PATH = candidate.basePath;
      return result;
    } catch (error) {
      lastError = error;
      if (!(error instanceof ApiError) || error.status !== 404) {
        throw error;
      }
    }
  }

  throw (lastError instanceof Error
    ? lastError
    : new ApiError("Upload echoue.", 500));
}

export async function getMediaUploadProgress(
  uploadId: string
): Promise<BackendUploadProgress> {
  return mediaRequest<BackendUploadProgress>({
    pathSuffix: `/upload-progress/${encodeURIComponent(uploadId)}`,
    method: "GET",
  });
}

export async function deleteMedia(path: string): Promise<void> {
  const query = new URLSearchParams({ path });
  await mediaRequest<{ success: true }>({
    pathSuffix: `?${query.toString()}`,
    method: "DELETE",
  });
}
