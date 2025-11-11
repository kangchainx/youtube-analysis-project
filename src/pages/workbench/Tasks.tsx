import {
  type ReactNode,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Spinner } from "@/components/ui/spinner";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import {
  fetchCompletedTasksWithDetails,
  fetchTranscriptionTasks,
  getTranscriptDownloadUrl,
  subscribeToTaskStream,
  type TaskDetailFile,
  type TaskListMeta,
  type TaskListRecord,
  type TaskStatus,
  type TaskStreamUpdate,
  type TaskStatusResponse,
} from "@/lib/video-transcription-api";
import { toast } from "sonner";
import { FileText, RefreshCcw } from "lucide-react";

const FINAL_STATUSES = new Set<TaskStatus>(["completed", "failed"]);
const DEFAULT_PAGE_SIZE = 10;

const TAB_CONFIG = {
  inProgress: {
    label: "进行中",
    statuses: ["pending", "processing"],
    emptyTitle: "暂无进行中的任务",
    emptyDescription: "创建新的转写任务即可在此查看实时进度。",
  },
  completed: {
    label: "已完成",
    statuses: ["completed"],
    emptyTitle: "暂时没有已完成任务",
    emptyDescription: "任务完成后，可在此下载对应文件。",
  },
  failed: {
    label: "失败",
    statuses: ["failed"],
    emptyTitle: "没有失败的任务",
    emptyDescription: "任务失败时会展示在此，并可查看失败原因。",
  },
} satisfies Record<
  string,
  {
    label: string;
    statuses: TaskStatus[];
    emptyTitle: string;
    emptyDescription: string;
  }
>;

type TaskTabKey = keyof typeof TAB_CONFIG;

type TaskListItem = {
  id: string;
  taskId: string;
  status: TaskStatus;
  progress: number | null;
  errorMessage: string | null;
  createdAt: number;
  updatedAt: number;
  title: string;
  videoSource?: string | null;
  videoSourceUrl?: string | null;
  details?: TaskDetailFile[];
};

type TaskTabState = {
  page: number;
  items: TaskListItem[];
  meta: TaskListMeta | null;
  isLoading: boolean;
  error: string | null;
  initialized: boolean;
};

const createInitialTabState = (): TaskTabState => ({
  page: 1,
  items: [],
  meta: null,
  isLoading: false,
  error: null,
  initialized: false,
});

const filterRecordsByStatus = (
  records: TaskListItem[],
  statuses: TaskStatus[],
): TaskListItem[] => {
  if (!statuses.length) return records;
  const allowed = new Set(statuses);
  return records.filter((record) => allowed.has(record.status));
};

const normalizeProgress = (value?: number | null) => {
  if (value === null || value === undefined || Number.isNaN(value)) {
    return null;
  }
  const scaled = value <= 1 ? value * 100 : value;
  return Math.max(0, Math.min(100, Math.round(scaled)));
};

const parseTimestamp = (value?: string | number | null) => {
  if (value === null || value === undefined) return Date.now();
  if (typeof value === "number") return value;
  const parsed = Date.parse(value);
  return Number.isNaN(parsed) ? Date.now() : parsed;
};

const formatDate = (timestamp: number) => {
  if (!timestamp) return "-";
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(new Date(timestamp));
};

const formatFileSize = (size?: number) => {
  if (!size || size <= 0) return "未知大小";
  if (size < 1024) return `${size} B`;
  if (size < 1024 * 1024)
    return `${(size / 1024).toFixed(1).replace(/\.0$/, "")} KB`;
  return `${(size / (1024 * 1024)).toFixed(1).replace(/\.0$/, "")} MB`;
};

function mapTaskRecord(record: TaskListRecord): TaskListItem {
  return {
    id: record.id ?? record.taskId,
    taskId: record.taskId ?? record.id,
    status: record.status,
    progress: normalizeProgress(record.progress),
    errorMessage: record.errorMessage ?? null,
    createdAt: parseTimestamp(record.createdAt),
    updatedAt: parseTimestamp(record.updatedAt),
    title: record.title ?? record.videoSource ?? record.taskId,
    videoSource: record.videoSource ?? record.title ?? record.taskId,
    videoSourceUrl: record.videoSourceUrl ?? null,
    details: record.details,
  };
}

const extractVideoIdentifier = (url?: string | null): string | null => {
  if (!url) return null;
  try {
    const match = /[?&]v=([^&]+)/.exec(url);
    if (match?.[1]) {
      return match[1];
    }
    const trimmed = url.replace(/\/+$/, "");
    const segments = trimmed.split("/");
    return segments.at(-1) || url;
  } catch {
    return url;
  }
};

type EllipsisTextProps = {
  value?: string | null;
  displayValue?: string | null;
  className?: string;
  href?: string | null;
};

function EllipsisText({
  value,
  displayValue,
  className,
  href,
}: EllipsisTextProps) {
  if (!value) {
    return (
      <span className={cn("text-sm text-muted-foreground", className)}>-</span>
    );
  }
  const text = displayValue ?? value;

  const content = href ? (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className={cn(
        "text-sm text-primary underline-offset-2 hover:underline",
        "block max-w-full truncate",
        className,
      )}
    >
      {text}
    </a>
  ) : (
    <span
      className={cn(
        "text-sm text-foreground",
        "block max-w-full truncate",
        className,
      )}
    >
      {text}
    </span>
  );

  return (
    <Tooltip>
      <TooltipTrigger asChild>{content}</TooltipTrigger>
      <TooltipContent className="max-w-sm break-all text-sm">
        {value}
      </TooltipContent>
    </Tooltip>
  );
}

function TasksPage() {
  const [activeTab, setActiveTab] = useState<TaskTabKey>("inProgress");
  const [tabStates, setTabStates] = useState<Record<TaskTabKey, TaskTabState>>({
    inProgress: createInitialTabState(),
    completed: createInitialTabState(),
    failed: createInitialTabState(),
  });
  const [downloadingFileKey, setDownloadingFileKey] = useState<string | null>(null);
  const tabStatesRef = useRef(tabStates);
  useEffect(() => {
    tabStatesRef.current = tabStates;
  }, [tabStates]);

  const streamCleanupRef = useRef<Map<string, () => void>>(new Map());

  const fetchTabData = useCallback(
    async (tabKey: TaskTabKey, pageOverride?: number) => {
      const targetPage = pageOverride ?? tabStatesRef.current[tabKey].page ?? 1;
      setTabStates((previous) => ({
        ...previous,
        [tabKey]: {
          ...previous[tabKey],
          isLoading: true,
          error: null,
          page: targetPage,
        },
      }));

      try {
        if (tabKey === "completed") {
          const response = await fetchCompletedTasksWithDetails({
            page: targetPage,
            pageSize: DEFAULT_PAGE_SIZE,
          });

          const normalizedItems = response.data.map((record) => ({
            ...mapTaskRecord(record),
            details: record.details ?? [],
          }));
          const filteredItems = filterRecordsByStatus(
            normalizedItems,
            TAB_CONFIG[tabKey].statuses,
          );

          setTabStates((previous) => ({
            ...previous,
            [tabKey]: {
              ...previous[tabKey],
              items: filteredItems,
              meta: response.meta,
              isLoading: false,
              error: null,
              initialized: true,
              page: targetPage,
            },
          }));
        } else {
          const response = await fetchTranscriptionTasks({
            page: targetPage,
            pageSize: DEFAULT_PAGE_SIZE,
            status: TAB_CONFIG[tabKey].statuses,
          });

          const normalizedItems = response.data.map(mapTaskRecord);
          const filteredItems = filterRecordsByStatus(
            normalizedItems,
            TAB_CONFIG[tabKey].statuses,
          );

          setTabStates((previous) => ({
            ...previous,
            [tabKey]: {
              ...previous[tabKey],
              items: filteredItems,
              meta: response.meta,
              isLoading: false,
              error: null,
              initialized: true,
              page: targetPage,
            },
          }));
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "任务加载失败";
        setTabStates((previous) => ({
          ...previous,
          [tabKey]: {
            ...previous[tabKey],
            isLoading: false,
            error: message,
            initialized: true,
          },
        }));
      }
    },
    [],
  );

  useEffect(() => {
    void fetchTabData("inProgress", 1);
  }, [fetchTabData]);

  const handleTabChange = useCallback(
    (tabKey: TaskTabKey) => {
      setActiveTab(tabKey);
      const state = tabStatesRef.current[tabKey];
      if (!state.initialized) {
        void fetchTabData(tabKey, 1);
      }
    },
    [fetchTabData],
  );

  const handlePageChange = useCallback(
    (tabKey: TaskTabKey, nextPage: number) => {
      if (nextPage < 1) return;
      void fetchTabData(tabKey, nextPage);
    },
    [fetchTabData],
  );

  const handleRefresh = useCallback(() => {
    const currentPage = tabStatesRef.current[activeTab].page ?? 1;
    void fetchTabData(activeTab, currentPage);
  }, [activeTab, fetchTabData]);

  const applyStreamUpdate = useCallback(
    (payload: TaskStreamUpdate | TaskStatusResponse) => {
      const status = payload.status as TaskStatus;
      const progress = normalizeProgress(payload.progress);
      const updatedAt = parseTimestamp(
        "updatedAt" in payload ? payload.updatedAt : undefined,
      );
      const errorMessage =
        "errorMessage" in payload && payload.errorMessage
          ? payload.errorMessage
          : null;

      setTabStates((previous) => {
        const currentItems = previous.inProgress.items;
        const recordId =
          ("taskRecordId" in payload && payload.taskRecordId) ||
          ("id" in payload ? payload.id : undefined);
        const index = currentItems.findIndex(
          (item) =>
            item.taskId === payload.taskId ||
            (recordId ? item.id === recordId : false),
        );
        if (index === -1) return previous;
        const nextItems = [...currentItems];
        const updatedItem: TaskListItem = {
          ...nextItems[index],
          status,
          progress,
          updatedAt,
          errorMessage,
        };
        if (FINAL_STATUSES.has(status)) {
          nextItems.splice(index, 1);
        } else {
          nextItems[index] = updatedItem;
        }
        return {
          ...previous,
          inProgress: {
            ...previous.inProgress,
            items: nextItems,
          },
        };
      });

      if (FINAL_STATUSES.has(status)) {
        const cleanup = streamCleanupRef.current.get(payload.taskId);
        cleanup?.();
        streamCleanupRef.current.delete(payload.taskId);

        void fetchTabData(
          "inProgress",
          tabStatesRef.current.inProgress.page ?? 1,
        );
        if (
          status === "completed" &&
          tabStatesRef.current.completed.initialized
        ) {
          void fetchTabData(
            "completed",
            tabStatesRef.current.completed.page ?? 1,
          );
        }
        if (status === "failed" && tabStatesRef.current.failed.initialized) {
          void fetchTabData("failed", tabStatesRef.current.failed.page ?? 1);
        }
      }
    },
    [fetchTabData],
  );

  const ensureStreamForTask = useCallback(
    (task: TaskListItem) => {
      if (FINAL_STATUSES.has(task.status)) return;
      if (streamCleanupRef.current.has(task.taskId)) return;

      const unsubscribe = subscribeToTaskStream(task.taskId, {
        onSnapshot: applyStreamUpdate,
        onUpdate: applyStreamUpdate,
        onError: () => {
          streamCleanupRef.current.delete(task.taskId);
        },
      });

      streamCleanupRef.current.set(task.taskId, unsubscribe);
    },
    [applyStreamUpdate],
  );

  useEffect(() => {
    tabStates.inProgress.items.forEach((task) => {
      ensureStreamForTask(task);
    });

    const currentTaskIds = new Set(
      tabStates.inProgress.items.map((task) => task.taskId),
    );
    streamCleanupRef.current.forEach((cleanup, taskId) => {
      if (!currentTaskIds.has(taskId)) {
        cleanup();
        streamCleanupRef.current.delete(taskId);
      }
    });
  }, [tabStates.inProgress.items, ensureStreamForTask]);

  useEffect(() => {
    return () => {
      streamCleanupRef.current.forEach((cleanup) => cleanup());
      streamCleanupRef.current.clear();
    };
  }, []);

  const handleDownload = useCallback(
    async (taskId: string, fileName: string) => {
      const downloadKey = `${taskId}:${fileName}`;
      setDownloadingFileKey(downloadKey);
      try {
        const url = await getTranscriptDownloadUrl(taskId, fileName);
        if (typeof window !== "undefined") {
          window.open(url, "_blank", "noopener,noreferrer");
        }
      } catch (error) {
        const message = error instanceof Error ? error.message : "下载链接获取失败";
        toast.error(message);
      } finally {
        setDownloadingFileKey((current) => (current === downloadKey ? null : current));
      }
    },
    [],
  );

  const renderPagination = (tabKey: TaskTabKey) => {
    const state = tabStates[tabKey];
    const totalPages = state.meta?.totalPages ?? 0;
    if (!totalPages || totalPages <= 1) return null;
    return (
      <div className="mt-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          第 {state.page} / {totalPages} 页 · 共 {state.meta?.total ?? 0} 个任务
        </p>
        <Pagination>
          <PaginationContent>
            <PaginationItem>
              <PaginationPrevious
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (state.page > 1) {
                    handlePageChange(tabKey, state.page - 1);
                  }
                }}
                className={cn(
                  state.page <= 1 && "pointer-events-none opacity-40",
                )}
              />
            </PaginationItem>
            <PaginationItem>
              <PaginationNext
                href="#"
                onClick={(event) => {
                  event.preventDefault();
                  if (state.page < totalPages) {
                    handlePageChange(tabKey, state.page + 1);
                  }
                }}
                className={cn(
                  state.page >= totalPages && "pointer-events-none opacity-40",
                )}
              />
            </PaginationItem>
          </PaginationContent>
        </Pagination>
      </div>
    );
  };

  const renderEmptyState = (tabKey: TaskTabKey) => (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
      <FileText className="h-10 w-10 text-muted-foreground/70" />
      <div>
        <p className="font-medium text-foreground">
          {TAB_CONFIG[tabKey].emptyTitle}
        </p>
        <p className="mt-1 text-sm text-muted-foreground">
          {TAB_CONFIG[tabKey].emptyDescription}
        </p>
      </div>
    </div>
  );

  const renderErrorState = (tabKey: TaskTabKey, message: string) => (
    <div className="flex flex-col items-center gap-3 py-12 text-center text-sm text-muted-foreground">
      <p className="text-destructive">{message}</p>
      <Button
        size="sm"
        onClick={() => fetchTabData(tabKey, tabStatesRef.current[tabKey].page)}
      >
        重试
      </Button>
    </div>
  );

  const renderFileField = (
    details: TaskDetailFile[] | undefined,
    field: "name" | "size" | "format",
    options?: { className?: string },
  ): ReactNode => {
    const file = details?.[0];
    if (!file) {
      return <span className="text-sm text-muted-foreground">-</span>;
    }
    if (field === "name") {
      return (
        <EllipsisText
          value={file.fileName}
          className={cn("max-w-[220px]", options?.className)}
        />
      );
    }
    if (field === "size") {
      return (
        <span className="text-sm text-foreground">
          {formatFileSize(file.fileSize)}
        </span>
      );
    }
    return (
      <span className="text-sm text-foreground">
        {file.fileFormat ? file.fileFormat.toUpperCase() : "-"}
      </span>
    );
  };

  const renderInProgressTable = () => {
    const state = tabStates.inProgress;
    if (state.error) return renderErrorState("inProgress", state.error);
    if (state.isLoading && state.items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
          <Spinner className="h-6 w-6 text-foreground" />
          <p>正在加载任务...</p>
        </div>
      );
    }
    if (!state.isLoading && state.items.length === 0) {
      return renderEmptyState("inProgress");
    }
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">序号</TableHead>
              <TableHead className="w-[20%] text-center">视频链接</TableHead>
              <TableHead className="text-center">视频源</TableHead>
              <TableHead className="min-w-[220px] text-center">进度</TableHead>
              <TableHead className="text-center">创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.items.map((task, index) => {
              const progressLabel =
                task.progress === null ? "处理中..." : `${task.progress}%`;
              const displayVideoId =
                extractVideoIdentifier(task.videoSourceUrl) ??
                task.videoSourceUrl;
              return (
                <TableRow key={`${task.id}-${task.updatedAt}`}>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {((state.page ?? 1) - 1) * DEFAULT_PAGE_SIZE + index + 1}
                  </TableCell>
                  <TableCell className="w-[20%] min-w-0 text-center">
                    <EllipsisText
                      value={task.videoSourceUrl}
                      displayValue={displayVideoId}
                      href={task.videoSourceUrl}
                      className="mx-auto max-w-[240px]"
                    />
                  </TableCell>
                  <TableCell className="min-w-0 text-center">
                    <EllipsisText
                      value={task.videoSource ?? task.title}
                      className="mx-auto max-w-[220px]"
                    />
                  </TableCell>
                  <TableCell className="min-w-[220px] text-center">
                    <div className="space-y-1">
                      <Progress
                        value={task.progress ?? undefined}
                        indeterminate={task.progress === null}
                      />
                      <p className="text-xs text-muted-foreground">
                        {progressLabel}
                      </p>
                    </div>
                  </TableCell>
                  <TableCell className="text-center text-sm text-muted-foreground">
                    {formatDate(task.createdAt)}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {renderPagination("inProgress")}
      </>
    );
  };

  const renderCompletedTable = () => {
    const state = tabStates.completed;
    if (state.error) return renderErrorState("completed", state.error);
    if (state.isLoading && state.items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
          <Spinner className="h-6 w-6 text-foreground" />
          <p>正在获取已完成任务...</p>
        </div>
      );
    }
    if (!state.isLoading && state.items.length === 0) {
      return renderEmptyState("completed");
    }
    const startIndex = ((state.page ?? 1) - 1) * DEFAULT_PAGE_SIZE;
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">序号</TableHead>
              <TableHead className="w-[18%] text-center">视频链接</TableHead>
              <TableHead className="text-center">视频源</TableHead>
              <TableHead className="w-[35%] text-center">文件名</TableHead>
              <TableHead className="text-center">文件大小</TableHead>
              <TableHead className="text-center">文件格式</TableHead>
              <TableHead className="text-center">创建时间</TableHead>
              <TableHead className="text-center">操作</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.items.map((task, index) => {
              const primaryFile = task.details?.[0];
              const downloadKey = primaryFile
                ? `${task.taskId}:${primaryFile.fileName}`
                : null;
              const isDownloading = Boolean(
                downloadKey && downloadingFileKey === downloadKey,
              );
              return (
                <TableRow key={`${task.id}-${task.updatedAt}`}>
                  <TableCell className="text-center text-sm text-muted-foreground align-middle">
                    {startIndex + index + 1}
                  </TableCell>
                  <TableCell className="w-[18%] min-w-0 text-center align-middle">
                    <EllipsisText
                      value={task.videoSourceUrl}
                      displayValue={
                        extractVideoIdentifier(task.videoSourceUrl) ??
                        task.videoSourceUrl
                      }
                      href={task.videoSourceUrl}
                      className="mx-auto max-w-[180px]"
                    />
                  </TableCell>
                  <TableCell className="min-w-0 text-center align-middle">
                    <EllipsisText
                      value={task.videoSource ?? task.title}
                      className="mx-auto max-w-[220px]"
                    />
                  </TableCell>
                  <TableCell className="w-[35%] min-w-0 text-center align-middle">
                    {renderFileField(task.details, "name", {
                      className: "mx-auto max-w-[300px]",
                    })}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    {renderFileField(task.details, "size")}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    {renderFileField(task.details, "format")}
                  </TableCell>
                  <TableCell className="text-center align-middle text-sm text-muted-foreground">
                    {formatDate(task.createdAt)}
                  </TableCell>
                  <TableCell className="text-center align-middle">
                    {primaryFile ? (
                      <Button
                        variant="default"
                        size="sm"
                        disabled={isDownloading}
                        onClick={() =>
                          handleDownload(task.taskId, primaryFile.fileName)
                        }
                      >
                        {isDownloading ? "获取链接..." : "下载"}
                      </Button>
                    ) : (
                      <Button variant="ghost" size="sm" disabled>
                        下载
                      </Button>
                    )}
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {renderPagination("completed")}
      </>
    );
  };

  const renderFailedTable = () => {
    const state = tabStates.failed;
    if (state.error) return renderErrorState("failed", state.error);
    if (state.isLoading && state.items.length === 0) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
          <Spinner className="h-6 w-6 text-foreground" />
          <p>正在获取失败任务...</p>
        </div>
      );
    }
    if (!state.isLoading && state.items.length === 0) {
      return renderEmptyState("failed");
    }
    const startIndex = ((state.page ?? 1) - 1) * DEFAULT_PAGE_SIZE;
    return (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-14 text-center">序号</TableHead>
              <TableHead className="w-[18%] text-center">视频链接</TableHead>
              <TableHead className="text-center">视频源</TableHead>
              <TableHead className="w-[40%] text-center">错误信息</TableHead>
              <TableHead className="text-center">创建时间</TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {state.items.map((task, index) => (
              <TableRow key={`${task.id}-${task.updatedAt}`}>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {startIndex + index + 1}
                </TableCell>
                <TableCell className="w-[18%] min-w-0 text-center">
                  <EllipsisText
                    value={task.videoSourceUrl}
                    displayValue={
                      extractVideoIdentifier(task.videoSourceUrl) ??
                      task.videoSourceUrl
                    }
                    href={task.videoSourceUrl}
                    className="mx-auto max-w-[180px]"
                  />
                </TableCell>
                <TableCell className="min-w-0 text-center">
                  <EllipsisText
                    value={task.videoSource ?? task.title}
                    className="mx-auto max-w-[220px]"
                  />
                </TableCell>
                <TableCell className="w-[40%] min-w-0 text-center">
                  <EllipsisText
                    value={task.errorMessage ?? "任务失败"}
                    className="mx-auto max-w-[360px]"
                  />
                </TableCell>
                <TableCell className="text-center text-sm text-muted-foreground">
                  {formatDate(task.createdAt)}
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
        {renderPagination("failed")}
      </>
    );
  };

  const renderTabContent = () => {
    switch (activeTab) {
      case "inProgress":
        return renderInProgressTable();
      case "completed":
        return renderCompletedTable();
      case "failed":
        return renderFailedTable();
      default:
        return null;
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-semibold text-foreground">任务中心</h1>
      </div>
      <div className="rounded-xl border bg-background shadow-sm">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TAB_CONFIG) as TaskTabKey[]).map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                className={cn(
                  "rounded-full px-4 py-1.5 text-sm font-medium transition",
                  activeTab === tabKey
                    ? "bg-foreground text-background shadow"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => handleTabChange(tabKey)}
              >
                {TAB_CONFIG[tabKey].label}
              </button>
            ))}
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            className="gap-2"
            onClick={handleRefresh}
            disabled={tabStates[activeTab].isLoading}
          >
            <RefreshCcw className="h-4 w-4" /> 刷新
          </Button>
        </div>
        <div className="px-4 py-4 sm:px-6">{renderTabContent()}</div>
      </div>
    </div>
  );
}

export default TasksPage;
