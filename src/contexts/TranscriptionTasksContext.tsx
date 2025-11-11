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

export type TranscriptionTaskItem = {
  id: string;
  taskId: string;
  vttId?: string;
  title: string;
  status: TaskStatus;
  progress: number | null;
  createdAt: number;
  updatedAt: number;
  sourceUrl: string;
  summaryLanguage?: string;
  exportFormat?: CreateTranscriptionTaskRequest["exportFormat"];
  includeTimestamps?: boolean;
  includeHeader?: boolean;
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
            vttId: status.id,
            title: "转录任务",
            status: "pending",
            progress: null,
            createdAt: serverCreatedAt ?? now,
            updatedAt: now,
            sourceUrl: status.videoSourceUrl ?? "",
            summaryLanguage: undefined,
            exportFormat: undefined,
            includeHeader: undefined,
            includeTimestamps: undefined,
            files: [],
            message: null,
            error: null,
          };

        const resolvedStatus = (status.status || baseTask.status) as TaskStatus;
        const progress =
          normalizeProgress(status.progress) ??
          (resolvedStatus === "completed" ? 100 : baseTask.progress ?? null);

        return {
          ...baseTask,
          taskId,
          vttId: status.id ?? baseTask.vttId,
          status: resolvedStatus,
          progress,
          createdAt: baseTask.createdAt ?? serverCreatedAt ?? now,
          updatedAt: serverUpdatedAt ?? now,
          sourceUrl: status.videoSourceUrl || baseTask.sourceUrl,
          error:
            resolvedStatus === "failed"
              ? status.errorMessage ?? baseTask.error ?? "任务失败"
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
          url: options.url,
          summaryLanguage: options.summaryLanguage,
          exportFormat: options.exportFormat,
          includeHeader: options.includeHeader,
          includeTimestamps: options.includeTimestamps,
        });
        const taskId = response.taskId;
        const initialStatus = (response.status as TaskStatus) || "processing";
        const now = Date.now();
        const newTask: TranscriptionTaskItem = {
          id: taskId,
          taskId,
          vttId: response.id,
          title: options.title || "转录任务",
          status: initialStatus,
          progress: initialStatus === "completed" ? 100 : 0,
          createdAt: now,
          updatedAt: now,
          sourceUrl: options.url,
          summaryLanguage: options.summaryLanguage,
          exportFormat: options.exportFormat,
          includeHeader: options.includeHeader,
          includeTimestamps: options.includeTimestamps,
          files: [],
          message: response.message ?? null,
          error: null,
        };
        setTasksMap((previous) => ({
          ...previous,
          [taskId]: newTask,
        }));
        // Kick off an immediate status fetch so UI reflects backend state quickly.
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
