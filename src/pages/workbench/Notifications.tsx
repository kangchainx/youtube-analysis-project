import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import {
  type NotificationListMeta,
  type NotificationRecord,
  type NotificationStatus,
  fetchNotifications,
  markAllNotificationsAsRead,
  markNotificationAsRead,
} from "@/lib/notifications-api";
import { useNotifications } from "@/contexts/NotificationsContext";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { Spinner } from "@/components/ui/spinner";
import { Button } from "@/components/ui/button";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { toast } from "sonner";
import { BellRing, RefreshCcw } from "lucide-react";
import { DataErrorState } from "@/components/ui/data-error-state";

const DEFAULT_PAGE_SIZE = 20;

const formatDateTime = (value?: string) => {
  if (!value) return "-";
  const timestamp = Date.parse(value);
  if (Number.isNaN(timestamp)) return value;
  return new Intl.DateTimeFormat(undefined, {
    year: "numeric",
    month: "short",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(timestamp);
};

const STATUS_COPY: Record<string, { label: string; className: string }> = {
  unread: { label: "未读", className: "bg-primary/10 text-primary" },
  read: { label: "已读", className: "bg-muted text-muted-foreground" },
};

const TAB_CONFIG = {
  unread: {
    label: "未读",
    status: "unread" as NotificationStatus,
    emptyTitle: "暂无未读通知",
    emptyDescription: "新的任务状态更新会在此处第一时间展示。",
  },
  read: {
    label: "已读",
    status: "read" as NotificationStatus,
    emptyTitle: "暂无已读通知",
    emptyDescription: "已读通知会保存在这里，方便后续回顾。",
  },
} as const;

type NotificationTabKey = keyof typeof TAB_CONFIG;

type NotificationsContextValue = ReturnType<typeof useNotifications> | null;

function useSafeNotifications(): NotificationsContextValue {
  try {
    return useNotifications();
  } catch (error) {
    if (
      error instanceof Error &&
      error.message.includes("NotificationsProvider")
    ) {
      if (import.meta.env?.DEV) {
        console.warn(
          "NotificationsPage rendered outside of NotificationsProvider; live updates disabled.",
        );
      }
      return null;
    }
    throw error;
  }
}

function StatusBadge({ status }: { status: string }) {
  const normalized = status?.toLowerCase?.() ?? "";
  const config = STATUS_COPY[normalized] ?? {
    label: status || "未知",
    className: "bg-muted text-foreground",
  };
  return (
    <span
      className={cn(
        "inline-flex items-center rounded-full px-2.5 py-1 text-xs font-medium",
        config.className,
      )}
    >
      {config.label}
    </span>
  );
}

function NotificationsPage() {
  const notificationsContext = useSafeNotifications();
  const lastReceivedAt = notificationsContext?.lastReceivedAt ?? null;
  const refreshUnreadCount = notificationsContext?.refreshUnreadCount;
  const [activeTab, setActiveTab] = useState<NotificationTabKey>("unread");
  const [page, setPage] = useState(1);
  const [items, setItems] = useState<NotificationRecord[]>([]);
  const [meta, setMeta] = useState<NotificationListMeta | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [markingIds, setMarkingIds] = useState<Set<string>>(() => new Set());
  const [isMarkingAll, setIsMarkingAll] = useState(false);
  const requestIdRef = useRef(0);

  const loadPage = useCallback(
    async (targetPage: number, tab: NotificationTabKey) => {
      const requestId = ++requestIdRef.current;
      setIsLoading(true);
      setError(null);
      try {
        const response = await fetchNotifications({
          page: targetPage,
          pageSize: DEFAULT_PAGE_SIZE,
          msgStatus: TAB_CONFIG[tab].status,
        });
        if (requestId !== requestIdRef.current) return;
        setItems(response.data);
        setMeta(response.meta);
        setPage(response.meta.page);
      } catch (err) {
        if (requestId !== requestIdRef.current) return;
        const message =
          err instanceof Error ? err.message : "通知加载失败，请稍后重试";
        setError(message);
      } finally {
        if (requestId === requestIdRef.current) {
          setIsLoading(false);
        }
      }
    },
    [],
  );

  useEffect(() => {
    void loadPage(1, activeTab);
  }, [activeTab, loadPage]);

  useEffect(() => {
    if (!lastReceivedAt) return;
    if (page !== 1) return;
    if (activeTab !== "unread") return;
    void loadPage(1, "unread");
  }, [lastReceivedAt, page, activeTab, loadPage]);

  const totalPages = meta?.totalPages ?? 0;

  const handleRetry = () => {
    void loadPage(page || 1, activeTab);
  };

  const handlePageChange = (direction: "prev" | "next") => {
    if (!meta) return;
    const nextPage =
      direction === "prev"
        ? Math.max(1, page - 1)
        : Math.min(totalPages, page + 1);
    if (nextPage === page) return;
    void loadPage(nextPage, activeTab);
  };

  const handleTabChange = (tab: NotificationTabKey) => {
    if (tab === activeTab) return;
    setPage(1);
    setActiveTab(tab);
  };

  const handleRefresh = () => {
    void loadPage(page || 1, activeTab);
  };

  const handleMarkAllAsRead = async () => {
    if (activeTab !== "unread") return;
    setIsMarkingAll(true);
    try {
      await markAllNotificationsAsRead();
      toast.success("所有未读通知已标记为已读");
      await refreshUnreadCount?.();
      void loadPage(1, activeTab);
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "批量标记失败，请稍后重试";
      toast.error(message);
    } finally {
      setIsMarkingAll(false);
    }
  };

  const handleMarkAsRead = async (id: string) => {
    if (markingIds.has(id)) return;
    setMarkingIds((current) => {
      const next = new Set(current);
      next.add(id);
      return next;
    });
    try {
      await markNotificationAsRead(id);
      toast.success("已标记为已读");
      await refreshUnreadCount?.();
      if (activeTab === "unread") {
        void loadPage(page || 1, activeTab);
      } else {
        setItems((current) =>
          current.map((item) =>
            item.id === id ? { ...item, msgStatus: "read" } : item,
          ),
        );
      }
    } catch (err) {
      const message =
        err instanceof Error ? err.message : "标记为已读失败，请稍后重试";
      toast.error(message);
    } finally {
      setMarkingIds((current) => {
        const next = new Set(current);
        next.delete(id);
        return next;
      });
    }
  };

  const emptyState = useMemo(() => {
    if (isLoading) {
      return (
        <div className="flex flex-col items-center gap-3 py-12 text-sm text-muted-foreground">
          <Spinner className="h-6 w-6 text-foreground" />
          <p>正在加载通知...</p>
        </div>
      );
    }
    const { emptyTitle, emptyDescription } = TAB_CONFIG[activeTab];
    const iconColorClass =
      activeTab === "unread" ? "text-primary" : "text-muted-foreground";
    return (
      <div className="flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 px-6 py-12 text-center">
        <div className="flex h-16 w-16 items-center justify-center rounded-full bg-muted/60 text-muted-foreground">
          <BellRing className={cn("h-8 w-8", iconColorClass)} />
        </div>
        <p className="text-base font-medium text-foreground">{emptyTitle}</p>
        <p className="text-sm text-muted-foreground">{emptyDescription}</p>
      </div>
    );
  }, [isLoading, activeTab]);

  return (
    <section className="flex flex-col gap-6">
      <header>
        <h1 className="text-2xl font-semibold text-foreground">通知中心</h1>
      </header>

      <div className="rounded-lg border border-border/60 bg-background">
        <div className="flex flex-wrap items-center justify-between gap-3 border-b border-border/60 px-4 py-3 sm:px-6">
          <div className="flex flex-wrap gap-2">
            {(Object.keys(TAB_CONFIG) as NotificationTabKey[]).map((tabKey) => (
              <button
                key={tabKey}
                type="button"
                className={cn(
                  "rounded-full border border-transparent px-4 py-1.5 text-sm font-medium transition",
                  activeTab === tabKey
                    ? "bg-primary/10 text-primary border-primary/50"
                    : "text-muted-foreground hover:text-foreground",
                )}
                onClick={() => handleTabChange(tabKey)}
              >
                {TAB_CONFIG[tabKey].label}
              </button>
            ))}
          </div>
          <div className="flex items-center gap-2">
            {activeTab === "unread" ? (
              <Button
                variant="outline"
                size="sm"
                onClick={handleMarkAllAsRead}
                disabled={isLoading || isMarkingAll || items.length === 0}
              >
                {isMarkingAll ? "标记中..." : "全部标记为已读"}
              </Button>
            ) : null}
            <Button
              variant="ghost"
              size="sm"
              className="gap-2"
              onClick={handleRefresh}
              disabled={isLoading}
            >
              <RefreshCcw className="h-4 w-4" />
              刷新
            </Button>
          </div>
        </div>
        <div className="px-4 py-4 sm:px-6">
          {error ? (
            <DataErrorState onRetry={handleRetry} />
          ) : items.length === 0 ? (
            emptyState
          ) : (
            <>
              <Table>
                <TableHeader className="bg-muted/40 text-xs uppercase tracking-wide">
                  <TableRow>
                    <TableHead className="w-14 text-center">序号</TableHead>
                    <TableHead className="w-[15%] text-center">标题</TableHead>
                    <TableHead className="text-center">内容</TableHead>
                    {activeTab === "unread" ? (
                      <TableHead className="w-24 text-center">状态</TableHead>
                    ) : null}
                    <TableHead className="w-48 text-center">创建时间</TableHead>
                    {activeTab !== "unread" ? (
                      <TableHead className="w-48 text-center">
                        更新时间
                      </TableHead>
                    ) : null}
                    {activeTab === "unread" ? (
                      <TableHead className="w-32 text-center">操作</TableHead>
                    ) : null}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {items.map((item, index) => {
                    const isUnread =
                      item.msgStatus?.toLowerCase?.() === "unread";
                    const rowNumber = (page - 1) * DEFAULT_PAGE_SIZE + index + 1;
                    return (
                      <TableRow key={item.id} className="h-12">
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {rowNumber}
                        </TableCell>
                        <TableCell className="text-center text-sm font-medium text-foreground">
                          {item.msgTitle ?? "-"}
                        </TableCell>
                        <TableCell className="text-center">
                          <Tooltip>
                            <TooltipTrigger asChild>
                              <span className="mx-auto block max-w-[520px] truncate text-sm text-muted-foreground">
                                {item.msgContent ?? "-"}
                              </span>
                            </TooltipTrigger>
                            {item.msgContent ? (
                              <TooltipContent className="max-w-xl break-words text-sm leading-snug">
                                {item.msgContent}
                              </TooltipContent>
                            ) : null}
                          </Tooltip>
                        </TableCell>
                        {activeTab === "unread" ? (
                          <TableCell className="text-center">
                            <StatusBadge status={item.msgStatus} />
                          </TableCell>
                        ) : null}
                        <TableCell className="text-center text-sm text-muted-foreground">
                          {formatDateTime(item.createdAt)}
                        </TableCell>
                        {activeTab !== "unread" ? (
                          <TableCell className="text-center text-sm text-muted-foreground">
                            {formatDateTime(item.updatedAt)}
                          </TableCell>
                        ) : null}
                        {activeTab === "unread" ? (
                          <TableCell className="text-center">
                            {isUnread ? (
                              <Button
                                size="sm"
                                variant="link"
                                onClick={() => handleMarkAsRead(item.id)}
                                disabled={
                                  isLoading ||
                                  markingIds.has(item.id) ||
                                  isMarkingAll
                                }
                              >
                                {markingIds.has(item.id)
                                  ? "处理中..."
                                  : "标记已读"}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground">
                                已读
                              </span>
                            )}
                          </TableCell>
                        ) : null}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
              {totalPages > 1 && (
                <div className="flex flex-col gap-2 border-t border-border/60 px-4 py-3 sm:flex-row sm:items-center sm:justify-between sm:px-6">
                  <p className="text-sm text-muted-foreground">
                    {TAB_CONFIG[activeTab].label} · 第 {page} / {totalPages} 页
                    · 共 {meta?.total ?? 0} 条通知
                  </p>
                  <Pagination>
                    <PaginationContent>
                      <PaginationItem>
                        <PaginationPrevious
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            handlePageChange("prev");
                          }}
                          className={cn(
                            page <= 1 && "pointer-events-none opacity-40",
                          )}
                        />
                      </PaginationItem>
                      <PaginationItem>
                        <PaginationNext
                          href="#"
                          onClick={(event) => {
                            event.preventDefault();
                            handlePageChange("next");
                          }}
                          className={cn(
                            !totalPages || page >= totalPages
                              ? "pointer-events-none opacity-40"
                              : undefined,
                          )}
                        />
                      </PaginationItem>
                    </PaginationContent>
                  </Pagination>
                </div>
              )}
            </>
          )}
        </div>
      </div>
    </section>
  );
}

export default NotificationsPage;
