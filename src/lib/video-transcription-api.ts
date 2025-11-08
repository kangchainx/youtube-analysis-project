import { apiFetch, ApiError } from "@/lib/api-client";

const DEFAULT_TRANSCRIPTION_BASE_URL = "http://localhost:8000";

const normalizeBaseUrl = (value?: string) => {
  if (!value) return DEFAULT_TRANSCRIPTION_BASE_URL;
  return value.endsWith("/") ? value.slice(0, -1) : value;
};

export const TRANSCRIPTION_API_BASE_URL = normalizeBaseUrl(
  import.meta.env.VITE_TRANSCRIPTION_API_BASE_URL as string | undefined,
);

const withBase = (path: string) => {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${TRANSCRIPTION_API_BASE_URL}${normalizedPath}`;
};

export type ProcessVideoRequest = {
  url: string;
  summaryLanguage?: string;
};

export type ProcessVideoResponse = {
  task_id: string;
  message: string;
};

export type TaskStatus = "pending" | "processing" | "completed" | "failed" | string;

export type TaskStatusResponse = {
  status: TaskStatus;
  progress?: number;
  message?: string;
  video_title?: string;
  script?: string;
  summary?: string;
  translation?: string;
  script_path?: string;
  summary_path?: string;
  translation_path?: string;
  short_id?: string;
  safe_title?: string;
  detected_language?: string;
  summary_language?: string;
};

export type ActiveTasksResponse = {
  active_tasks: number;
  processing_urls: number;
  task_ids: string[];
};

export type CancelTaskResponse = {
  message: string;
};

export async function createTranscriptionTask(
  payload: ProcessVideoRequest,
  init?: RequestInit,
): Promise<ProcessVideoResponse> {
  if (!payload.url?.trim()) {
    throw new Error("url is required to create a transcription task.");
  }

  const formData = new FormData();
  formData.append("url", payload.url.trim());
  if (payload.summaryLanguage) {
    formData.append("summary_language", payload.summaryLanguage);
  }

  return apiFetch<ProcessVideoResponse>(withBase("/api/process-video"), {
    method: "POST",
    body: formData,
    ...init,
  });
}

export async function getTaskStatus(taskId: string): Promise<TaskStatusResponse> {
  if (!taskId) {
    throw new Error("taskId is required.");
  }
  return apiFetch<TaskStatusResponse>(withBase(`/api/task-status/${taskId}`));
}

type TaskStreamHandlers = {
  onUpdate: (status: TaskStatusResponse) => void;
  onHeartbeat?: () => void;
  onError?: (error: Event) => void;
  signal?: AbortSignal;
};

export function subscribeTaskStream(taskId: string, handlers: TaskStreamHandlers) {
  if (!taskId) {
    throw new Error("taskId is required to start SSE subscription.");
  }

  const eventSource = new EventSource(withBase(`/api/task-stream/${taskId}`));

  eventSource.onmessage = (event) => {
    try {
      const data = JSON.parse(event.data) as TaskStatusResponse & { type?: string };
      if (data?.type === "heartbeat") {
        handlers.onHeartbeat?.();
        return;
      }
      handlers.onUpdate(data);
    } catch (error) {
      console.warn("Failed to parse SSE payload", error);
    }
  };

  eventSource.onerror = (error) => {
    handlers.onError?.(error);
  };

  const cleanup = () => {
    eventSource.close();
  };

  if (handlers.signal) {
    if (handlers.signal.aborted) {
      cleanup();
      return cleanup;
    }
    handlers.signal.addEventListener("abort", cleanup, { once: true });
  }

  return cleanup;
}

export async function downloadTaskFile(filename: string): Promise<Blob> {
  if (
    !filename.toLowerCase().endsWith(".md") ||
    filename.includes("..") ||
    filename.includes("/") ||
    filename.includes("\\")
  ) {
    throw new Error("filename must be a .md file name without path separators.");
  }

  const response = await fetch(withBase(`/api/download/${filename}`), {
    method: "GET",
    headers: {
      Accept: "text/markdown, text/plain",
    },
  });

  if (!response.ok) {
    const payload = await response.text().catch(() => "");
    throw new ApiError(
      payload || `Download failed with status ${response.status}`,
      response.status,
      payload || null,
    );
  }

  return response.blob();
}

export async function cancelTask(taskId: string): Promise<CancelTaskResponse> {
  if (!taskId) throw new Error("taskId is required to cancel a task.");
  return apiFetch<CancelTaskResponse>(withBase(`/api/task/${taskId}`), {
    method: "DELETE",
  });
}

export async function getActiveTasks(): Promise<ActiveTasksResponse> {
  return apiFetch<ActiveTasksResponse>(withBase("/api/tasks/active"));
}
