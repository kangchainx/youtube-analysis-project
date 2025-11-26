import { API_BASE_URL, apiFetch } from "@/lib/api-client";

export type ExportFormat = "markdown" | "txt";

export type TaskStatus = "pending" | "processing" | "completed" | "failed" | string;

export type CreateTranscriptionTaskRequest = {
  videoUrl: string;
  videoSource?: string;
  language?: string;
  outputFormat?: ExportFormat;
};

export type CreateTranscriptionTaskResponse = TaskStatusResponse;

type CreateTaskEnvelope = {
  data?: CreateTranscriptionTaskResponse;
};

export type TaskDetailFile = {
  fileName: string;
  downloadUrl?: string;
  fileSize?: number;
  format?: string | null;
  language?: string | null;
};

export type TaskStatusResponse = {
  id?: string;
  taskId: string;
  status: TaskStatus;
  progress: number | null;
  message?: string | null;
  rawStatus?: string | null;
  files?: TaskDetailFile[];
  details?: TaskDetailFile[];
  createdAt?: string;
  updatedAt?: string;
  videoUrl?: string | null;
  videoSource?: string | null;
  videoSourceUrl?: string | null;
  progressMessage?: string | null;
  progress_message?: string | null;
  errorMessage?: string | null;
};

type TaskStatusEnvelope = {
  data?: TaskStatusResponse;
};

export type TaskListRecord = TaskStatusResponse & {
  title?: string | null;
};

export type TaskListMeta = {
  page: number;
  pageSize: number;
  total: number;
  totalPages: number;
};

export type TaskListResponse = {
  data: TaskListRecord[];
  meta: TaskListMeta;
};

type PaginatedTaskEnvelope = {
  data?: TaskListRecord[];
  meta?: TaskListMeta;
};

export type FetchTasksParams = {
  page?: number;
  pageSize?: number;
  status?: TaskStatus | TaskStatus[];
};

export type TaskStreamUpdate = TaskStatusResponse & {
  taskRecordId?: string;
};

export type TaskStreamHandlers = {
  onSnapshot?: (payload: TaskStatusResponse) => void;
  onUpdate?: (payload: TaskStreamUpdate) => void;
  onError?: (event: Event) => void;
};

type DownloadUrlEnvelope = {
  data?: {
    taskId?: string;
    url?: string;
    fileName?: string;
    format?: string;
    fileSize?: number;
    language?: string;
  };
};

const DEFAULT_OUTPUT_FORMAT: ExportFormat = "txt";

const ensureData = <T>(envelope: { data?: T } | T | null | undefined, errorMessage: string): T => {
  // 后端有时直接返回数据，有时包一层 data，这里统一抽取并在缺失时抛出语义化错误
  if (envelope && typeof envelope === "object" && "data" in envelope) {
    const data = (envelope as { data?: T }).data;
    if (data !== undefined) {
      return data;
    }
  }
  if (envelope && typeof envelope === "object" && !("data" in envelope)) {
    return envelope as T;
  }
  throw new Error(errorMessage);
};

const normalizeFiles = (files?: TaskDetailFile[] | null): TaskDetailFile[] => {
  if (!files || !Array.isArray(files)) return [];
  return files.map((file) => ({
    ...file,
    fileSize: typeof file.fileSize === "number" ? file.fileSize : Number(file.fileSize) || undefined,
    format: file.format ?? (file as { fileFormat?: string }).fileFormat ?? null,
    language: file.language ?? null,
  }));
};

const normalizeTaskPayload = (payload: TaskStatusResponse): TaskStatusResponse => {
  const files = normalizeFiles(payload.files ?? payload.details);
  const normalizedMessage =
    payload.message ??
    payload.progressMessage ??
    payload.progress_message ??
    payload.errorMessage ??
    null;
  const progressMessage =
    payload.progressMessage ?? payload.progress_message ?? normalizedMessage;
  const errorMessage =
    payload.errorMessage ??
    (payload.status === "failed" ? normalizedMessage : null) ??
    null;
  const resolvedVideoUrl = payload.videoSourceUrl ?? payload.videoUrl ?? null;

  return {
    ...payload,
    progress: payload.progress ?? null,
    message: normalizedMessage,
    progressMessage,
    progress_message: payload.progress_message ?? null,
    errorMessage,
    files,
    details: files,
    videoUrl: payload.videoUrl ?? resolvedVideoUrl,
    videoSourceUrl: payload.videoSourceUrl ?? resolvedVideoUrl,
  };
};

export async function createTranscriptionTask(
  payload: CreateTranscriptionTaskRequest,
): Promise<CreateTranscriptionTaskResponse> {
  const videoUrl = payload.videoUrl?.trim();
  if (!videoUrl) {
    throw new Error("videoUrl is required to create a transcription task.");
  }

  const body: Record<string, unknown> = {
    videoUrl,
    output_format: payload.outputFormat ?? DEFAULT_OUTPUT_FORMAT,
  };

  if (payload.videoSource?.trim()) {
    body.videoSource = payload.videoSource.trim();
  }
  if (payload.language?.trim()) {
    body.language = payload.language.trim();
  }

  const response = await apiFetch<CreateTaskEnvelope>("/api/video-translate/tasks", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = ensureData(response, "创建任务失败，请稍后重试。");
  if (!data?.taskId) {
    throw new Error("创建任务失败，缺少任务标识。");
  }

  return normalizeTaskPayload({
    ...data,
    progress: data.progress ?? null,
  });
}

export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  if (!taskId) {
    throw new Error("taskId is required.");
  }

  const response = await apiFetch<TaskStatusEnvelope>(
    `/api/video-translate/tasks/${encodeURIComponent(taskId)}`,
  );

  const data = ensureData(response, "获取任务状态失败。");
  if (!data?.taskId) {
    throw new Error("任务状态数据异常，缺少标识。");
  }
  return normalizeTaskPayload({
    ...data,
    progress: data.progress ?? null,
  });
}

export async function fetchTranscriptionTasks(
  params: FetchTasksParams = {},
): Promise<TaskListResponse> {
  const searchParams = new URLSearchParams();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  if (page > 0) searchParams.set("page", String(page));
  if (pageSize > 0) searchParams.set("page_size", String(pageSize));
  if (pageSize > 0) searchParams.set("pageSize", String(pageSize));

  const statuses = Array.isArray(params.status)
    ? params.status
    : params.status
      ? [params.status]
      : [];
  statuses.forEach((status) => {
    if (status) {
      searchParams.append("status", status);
      searchParams.append("task_status", status);
      searchParams.append("taskStatus", status);
    }
  });

  const query = searchParams.toString();
  const response = await apiFetch<PaginatedTaskEnvelope>(
    `/api/video-translate/tasks${query ? `?${query}` : ""}`,
  );

  if (!response?.meta) {
    throw new Error("任务列表响应缺少 meta 字段。");
  }

  const normalizedData = (response.data ?? []).map((record) =>
    normalizeTaskPayload({
      ...record,
      progress: record.progress ?? null,
    }),
  );

  return {
    data: normalizedData,
    meta: response.meta,
  };
}

type FetchCompletedDetailsParams = {
  page?: number;
  pageSize?: number;
  status?: TaskStatus | TaskStatus[];
};

export async function fetchCompletedTasksWithDetails(
  params: FetchCompletedDetailsParams = {},
): Promise<TaskListResponse> {
  const searchParams = new URLSearchParams();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  if (page > 0) searchParams.set("page", String(page));
  if (pageSize > 0) searchParams.set("page_size", String(pageSize));
  if (pageSize > 0) searchParams.set("pageSize", String(pageSize));
  const statuses = Array.isArray(params.status)
    ? params.status
    : params.status
      ? [params.status]
      : [];
  statuses.forEach((status) => {
    if (status) {
      searchParams.append("status", status);
      searchParams.append("task_status", status);
      searchParams.append("taskStatus", status);
    }
  });

  const response = await apiFetch<PaginatedTaskEnvelope>(
    `/api/video-translate/tasks/details${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
  );

  if (!response?.meta) {
    throw new Error("任务详情列表响应缺少 meta 字段。");
  }

  const normalizedData = (response.data ?? []).map((record) =>
    normalizeTaskPayload({
      ...record,
      progress: record.progress ?? null,
    }),
  );

  const recordsWithFiles = await Promise.all(
    normalizedData.map(async (record) => {
      if (record.files?.length || record.details?.length) {
        return record;
      }
      try {
        const status = await getTaskStatus(record.taskId);
        if (status.files?.length) {
          return {
            ...record,
            ...status,
          };
        }
      } catch (error) {
        console.warn("Failed to fetch task details", record.taskId, error);
      }
      return record;
    }),
  );

  return {
    data: recordsWithFiles,
    meta: response.meta as TaskListMeta,
  };
}

export function subscribeToTaskStream(
  taskId: string,
  handlers: TaskStreamHandlers = {},
): () => void {
  if (!taskId || typeof window === "undefined" || typeof window.EventSource === "undefined") {
    return () => undefined;
  }

  const url = `${API_BASE_URL}/api/video-translate/tasks/${encodeURIComponent(taskId)}/stream`;
  const eventSource = new EventSource(url, { withCredentials: true });

  const parseEvent = <T>(event: MessageEvent): T | null => {
    try {
      return JSON.parse(event.data) as T;
    } catch (error) {
      console.warn("Failed to parse SSE payload", error);
      return null;
    }
  };

  const snapshotListener = (event: MessageEvent) => {
    const payload = parseEvent<TaskStatusResponse>(event);
    if (payload) {
      handlers.onSnapshot?.(normalizeTaskPayload(payload));
    }
  };

  const updateListener = (event: MessageEvent) => {
    const payload = parseEvent<TaskStreamUpdate>(event);
    if (payload) {
      handlers.onUpdate?.(normalizeTaskPayload(payload));
    }
  };

  const errorListener = (event: Event) => {
    handlers.onError?.(event);
  };

  eventSource.addEventListener("snapshot", snapshotListener as EventListener);
  eventSource.addEventListener("update", updateListener as EventListener);
  eventSource.addEventListener("error", errorListener);
  eventSource.addEventListener("ping", () => undefined);

  return () => {
    eventSource.removeEventListener("snapshot", snapshotListener as EventListener);
    eventSource.removeEventListener("update", updateListener as EventListener);
    eventSource.removeEventListener("error", errorListener);
    eventSource.close();
  };
}

export async function getTranscriptDownloadUrl(taskId: string): Promise<string> {
  if (!taskId) {
    throw new Error("taskId 不能为空");
  }
  const response = await apiFetch<DownloadUrlEnvelope>(
    `/api/video-translate/tasks/${encodeURIComponent(taskId)}/download-url`,
  );
  const url = response?.data?.url;
  if (!url) {
    throw new Error("无法获取下载链接，请稍后再试");
  }
  return url;
}
