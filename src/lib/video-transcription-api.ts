import { apiFetch } from "@/lib/api-client";

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
