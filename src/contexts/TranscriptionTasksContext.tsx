import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import {
  createTranscriptionTask,
  getTaskStatus,
  type CreateTranscriptionTaskRequest,
  type TaskDetailFile,
  type TaskStatus,
  type TaskStatusResponse,
} from "@/lib/video-transcription-api";

type CreateTaskOptions = CreateTranscriptionTaskRequest & {
  title: string;
};

const DEFAULT_VIDEO_SOURCE = "youtube";

export type TranscriptionTaskItem = {
  id: string;
  taskId: string;
  title: string;
  status: TaskStatus;
  progress: number | null;
  createdAt: number;
  updatedAt: number;
  sourceUrl: string;
  videoSource?: string;
  language?: string;
  outputFormat?: CreateTranscriptionTaskRequest["outputFormat"];
  files: TaskDetailFile[];
  message?: string | null;
  error?: string | null;
};

type TranscriptionTasksContextValue = {
  tasks: TranscriptionTaskItem[];
  createTask: (options: CreateTaskOptions) => Promise<TranscriptionTaskItem>;
  refreshTask: (taskId: string) => Promise<void>;
  isCreating: boolean;
};

const TranscriptionTasksContext = createContext<
  TranscriptionTasksContextValue | undefined
>(undefined);


const normalizeProgress = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  // 后端既可能返回 0-1 也可能返回 0-100，统一转成百分比并做边界保护
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
};

const parseTimestamp = (value?: string) => {
  if (!value) return null;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? null : parsed;
};

export function TranscriptionTasksProvider({
  children,
}: {
  children: ReactNode;
}) {
  const [tasksMap, setTasksMap] = useState<Record<string, TranscriptionTaskItem>>(
    {},
  );
  const [isCreating, setIsCreating] = useState(false);

  const upsertTask = useCallback(
    (
      taskId: string,
      updater: (current: TranscriptionTaskItem | undefined) => TranscriptionTaskItem,
    ) => {
      // 以 taskId 为键做幂等更新，确保并发状态更新时保持最新数据
      setTasksMap((previous) => {
        const current = previous[taskId];
        const nextTask = updater(current);
        if (!nextTask) return previous;
        return {
          ...previous,
          [taskId]: nextTask,
        };
      });
    },
    [],
  );

  const applyStatusUpdate = useCallback(
    (taskId: string, status: TaskStatusResponse) => {
      upsertTask(taskId, (current) => {
        const now = Date.now();
        const serverCreatedAt = parseTimestamp(status.createdAt);
        const serverUpdatedAt = parseTimestamp(status.updatedAt);
        const baseTask: TranscriptionTaskItem =
          current ?? {
            id: taskId,
            taskId,
            title: status.videoSource ?? "转录任务",
            status: "pending",
            progress: null,
            createdAt: serverCreatedAt ?? now,
            updatedAt: now,
            sourceUrl: status.videoUrl ?? status.videoSourceUrl ?? "",
            videoSource: status.videoSource ?? undefined,
            language: undefined,
            outputFormat: undefined,
            files: [],
            message: null,
            error: null,
          };

        const resolvedStatus = (status.status || baseTask.status) as TaskStatus;
        const progress =
          normalizeProgress(status.progress) ??
          (resolvedStatus === "completed" ? 100 : baseTask.progress ?? null);
        const files = status.files ?? status.details ?? baseTask.files;

        return {
          ...baseTask,
          taskId,
          status: resolvedStatus,
          progress,
          createdAt: baseTask.createdAt ?? serverCreatedAt ?? now,
          updatedAt: serverUpdatedAt ?? now,
          sourceUrl:
            status.videoUrl ?? status.videoSourceUrl ?? baseTask.sourceUrl,
          videoSource: status.videoSource ?? baseTask.videoSource,
          files,
          message: status.message ?? baseTask.message,
          error:
            resolvedStatus === "failed"
              ? status.message ?? status.errorMessage ?? baseTask.error ?? "任务失败"
              : null,
        };
      });
    },
    [upsertTask],
  );

  const refreshTask = useCallback(
    async (taskId: string) => {
      if (!taskId) return;
      try {
        // 定期从后端拉取任务状态，与 SSE 断线时的补偿
        const status = await getTaskStatus(taskId);
        applyStatusUpdate(taskId, status);
      } catch (error) {
        console.error("Failed to refresh transcription task", error);
      }
    },
    [applyStatusUpdate],
  );

  const createTask = useCallback(
    async (options: CreateTaskOptions) => {
      setIsCreating(true);
      try {
        const response = await createTranscriptionTask({
          videoUrl: options.videoUrl,
          videoSource: options.videoSource ?? DEFAULT_VIDEO_SOURCE,
          language: options.language,
          outputFormat: options.outputFormat,
        });
        const taskId = response.taskId;
        const initialStatus = (response.status as TaskStatus) || "processing";
        const initialProgress =
          normalizeProgress(response.progress) ??
          (initialStatus === "completed" ? 100 : 0);
        const now = Date.now();
        const newTask: TranscriptionTaskItem = {
          id: taskId,
          taskId,
          title: options.title || "转录任务",
          status: initialStatus,
          progress: initialProgress,
          createdAt: now,
          updatedAt: now,
          sourceUrl: response.videoUrl ?? options.videoUrl,
          videoSource:
            response.videoSource ?? options.videoSource ?? DEFAULT_VIDEO_SOURCE,
          language: options.language,
          outputFormat: options.outputFormat,
          files: response.files ?? response.details ?? [],
          message: response.message ?? null,
          error:
            initialStatus === "failed" ? response.message ?? null : null,
        };
        setTasksMap((previous) => ({
          ...previous,
          [taskId]: newTask,
        }));
        // 创建成功后立刻触发一次状态查询，让 UI 快速与后端状态对齐
        void refreshTask(taskId);
        return newTask;
      } finally {
        setIsCreating(false);
      }
    },
    [refreshTask],
  );

  const value = useMemo<TranscriptionTasksContextValue>(
    () => ({
      tasks: Object.values(tasksMap).sort(
        (a, b) => b.createdAt - a.createdAt || b.updatedAt - a.updatedAt,
      ),
      createTask,
      refreshTask,
      isCreating,
    }),
    [tasksMap, createTask, refreshTask, isCreating],
  );

  return (
    <TranscriptionTasksContext.Provider value={value}>
      {children}
    </TranscriptionTasksContext.Provider>
  );
}

export function useTranscriptionTasks() {
  const context = useContext(TranscriptionTasksContext);
  if (!context) {
    throw new Error(
      "useTranscriptionTasks must be used within a TranscriptionTasksProvider",
    );
  }
  return context;
}
