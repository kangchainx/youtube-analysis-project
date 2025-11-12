import { API_BASE_URL, apiFetch } from "@/lib/api-client";

export type ExportFormat = "markdown" | "txt" | "docx" | "pdf";

export type TaskStatus = "pending" | "processing" | "completed" | "failed" | string;

export type CreateTranscriptionTaskRequest = {
  url: string;
  summaryLanguage?: string;
  exportFormat?: ExportFormat;
  includeTimestamps?: boolean;
  includeHeader?: boolean;
};

export type CreateTranscriptionTaskResponse = {
  id: string;
  taskId: string;
  status: TaskStatus;
  message?: string;
};

type CreateTaskEnvelope = {
  data?: CreateTranscriptionTaskResponse;
};

export type TaskStatusResponse = {
  id: string;
  taskId: string;
  videoSource: string;
  videoSourceUrl: string;
  status: TaskStatus;
  progress: number | null;
  progressMessage?: string | null;
  progress_message?: string | null;
  errorMessage?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TaskStatusEnvelope = {
  data?: TaskStatusResponse;
};

export type TaskDetailFile = {
  id: number | string;
  vttId: string;
  fileName: string;
  filePath: string;
  fileSize: number;
  fileFormat: string;
  detectedLanguage?: string | null;
  createdAt?: string;
  updatedAt?: string;
};

type TaskDetailsEnvelope = {
  data?: TaskDetailFile[];
};

export type TaskListRecord = {
  id: string;
  taskId: string;
  status: TaskStatus;
  progress: number | null;
  errorMessage?: string | null;
  progressMessage?: string | null;
  progress_message?: string | null;
  createdAt?: string;
  updatedAt?: string;
  title?: string | null;
  videoSource?: string | null;
  videoSourceUrl?: string | null;
  details?: TaskDetailFile[];
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

export type TaskStreamUpdate = {
  taskRecordId?: string;
  taskId: string;
  status: TaskStatus;
  progress: number | null;
  progressMessage?: string | null;
  progress_message?: string | null;
  errorMessage?: string | null;
  updatedAt?: string;
};

export type TaskStreamHandlers = {
  onSnapshot?: (payload: TaskStatusResponse) => void;
  onUpdate?: (payload: TaskStreamUpdate) => void;
  onError?: (event: Event) => void;
};

type DownloadUrlEnvelope = {
  data?: {
    url?: string;
  };
};

const DEFAULT_SUMMARY_LANGUAGE = "zh";
const DEFAULT_EXPORT_FORMAT: ExportFormat = "markdown";

const normalizeBoolean = (value: boolean | string | undefined, fallback: boolean) => {
  if (value === undefined) return fallback;
  if (typeof value === "string") {
    return value.toLowerCase() === "true";
  }
  return Boolean(value);
};

const ensureData = <T>(envelope: { data?: T } | T | null | undefined, errorMessage: string): T => {
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

export async function createTranscriptionTask(
  payload: CreateTranscriptionTaskRequest,
): Promise<CreateTranscriptionTaskResponse> {
  if (!payload.url?.trim()) {
    throw new Error("url is required to create a transcription task.");
  }

  const body = {
    url: payload.url.trim(),
    summary_language: payload.summaryLanguage ?? DEFAULT_SUMMARY_LANGUAGE,
    export_format: payload.exportFormat ?? DEFAULT_EXPORT_FORMAT,
    export_include_timestamps: normalizeBoolean(payload.includeTimestamps, true),
    export_include_header: normalizeBoolean(payload.includeHeader, false),
  };

  const response = await apiFetch<CreateTaskEnvelope>("/api/video-transcription", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify(body),
  });

  const data = ensureData(response, "创建任务失败，请稍后重试。");
  if (!data?.taskId || !data?.id) {
    throw new Error("创建任务失败，缺少任务标识。");
  }
  return data;
}

export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  if (!taskId) {
    throw new Error("taskId is required.");
  }

  const response = await apiFetch<TaskStatusEnvelope>(
    `/api/video-transcription/task?task_id=${encodeURIComponent(taskId)}`,
  );

  const data = ensureData(response, "获取任务状态失败。");
  if (!data?.taskId) {
    throw new Error("任务状态数据异常，缺少标识。");
  }
  return data;
}

export async function getTaskDetails(vttId: string): Promise<TaskDetailFile[]> {
  if (!vttId) {
    throw new Error("vttId is required.");
  }

  const response = await apiFetch<TaskDetailsEnvelope>(
    `/api/video-transcription/details?vtt_id=${encodeURIComponent(vttId)}`,
  );

  const data = ensureData(response, "获取任务文件失败。");
  return Array.isArray(data) ? data : [];
}

export async function fetchTranscriptionTasks(
  params: FetchTasksParams = {},
): Promise<TaskListResponse> {
  const searchParams = new URLSearchParams();
  const page = params.page ?? 1;
  const pageSize = params.pageSize ?? 20;
  if (page > 0) searchParams.set("page", String(page));
  if (pageSize > 0) searchParams.set("page_size", String(pageSize));

  const statuses = Array.isArray(params.status)
    ? params.status
    : params.status
      ? [params.status]
      : [];
  statuses.forEach((status) => {
    if (status) {
      searchParams.append("status", status);
    }
  });

  const query = searchParams.toString();
  const response = await apiFetch<PaginatedTaskEnvelope>(
    `/api/video-transcription/tasks${query ? `?${query}` : ""}`,
  );

  if (!response?.meta) {
    throw new Error("任务列表响应缺少 meta 字段。");
  }

  return {
    data: response.data ?? [],
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
  const statuses = Array.isArray(params.status)
    ? params.status
    : params.status
      ? [params.status]
      : [];
  statuses.forEach((status) => {
    if (status) {
      searchParams.append("status", status);
    }
  });

  const response = await apiFetch<PaginatedTaskEnvelope>(
    `/api/video-transcription/tasks/details${searchParams.toString() ? `?${searchParams.toString()}` : ""}`,
  );

  if (!response?.meta) {
    throw new Error("任务详情列表响应缺少 meta 字段。");
  }

  return {
    data: response.data ?? [],
    meta: response.meta,
  };
}

export function subscribeToTaskStream(
  taskId: string,
  handlers: TaskStreamHandlers = {},
): () => void {
  if (!taskId || typeof window === "undefined" || typeof window.EventSource === "undefined") {
    return () => undefined;
  }

  const url = `${API_BASE_URL}/api/video-transcription/task/stream?task_id=${encodeURIComponent(taskId)}`;
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
      handlers.onSnapshot?.(payload);
    }
  };

  const updateListener = (event: MessageEvent) => {
    const payload = parseEvent<TaskStreamUpdate>(event);
    if (payload) {
      handlers.onUpdate?.(payload);
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

export async function getTranscriptDownloadUrl(
  taskId: string,
  fileName: string,
): Promise<string> {
  if (!taskId || !fileName) {
    throw new Error("taskId 和 fileName 不能为空");
  }
  const response = await apiFetch<DownloadUrlEnvelope>(
    `/api/video-transcription/download-url?task_id=${encodeURIComponent(taskId)}&file_name=${encodeURIComponent(fileName)}`,
  );
  const url = response?.data?.url;
  if (!url) {
    throw new Error("无法获取下载链接，请稍后再试");
  }
  return url;
}
