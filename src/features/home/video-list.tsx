import { Button } from "@/components/ui/button";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from "@/components/ui/card";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
import {
  HoverCard,
  HoverCardContent,
  HoverCardTrigger,
} from "@/components/ui/hover-card";
import {
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationEllipsis,
  PaginationLink,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { Input } from "@/components/ui/input";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { DataErrorState } from "@/components/ui/data-error-state";
import type { ChannelVideosState } from "@/features/home/search-input";
import { exportVideosToCsv, exportVideosToExcel } from "@/lib/export-utils";
import {
  BellMinus,
  BellPlus,
  Download,
  FileSpreadsheet,
  FileText,
  LayoutGrid,
  List,
  Loader2,
  MessageCircle,
  RefreshCw,
  ThumbsUp,
} from "lucide-react";
import { apiFetch, ApiError } from "@/lib/api-client";
import { toast } from "sonner";
import type { JSX, MouseEvent, ChangeEvent } from "react";
import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";

const PAGE_SIZE = 10;
const VIEW_MODE_STORAGE_KEY = "video-list:view-mode";

const getInitialViewMode = (): "table" | "card" => {
  if (typeof window === "undefined") return "table";
  try {
    const storedValue = window.localStorage.getItem(VIEW_MODE_STORAGE_KEY);
    return storedValue === "card" ? "card" : "table";
  } catch {
    return "table";
  }
};

interface VideoListProps {
  channelVideosState: ChannelVideosState;
  onRefresh?: () => void;
  showHotComments?: boolean;
  isGlobalSearchEnabled?: boolean;
  onSubscriptionChange?: (patch: Partial<ChannelVideosState>) => void;
}

function VideoList({
  channelVideosState,
  onRefresh,
  showHotComments = false,
  isGlobalSearchEnabled = false,
  onSubscriptionChange,
}: VideoListProps) {
  const { channelName, channelMetadata, videos, isLoading, error } =
    channelVideosState;

  const [currentPage, setCurrentPage] = useState(1);
  const [viewMode, setViewMode] = useState<"table" | "card">(
    getInitialViewMode,
  );
  const [titleFilter, setTitleFilter] = useState("");

  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(VIEW_MODE_STORAGE_KEY, viewMode);
    } catch {
      // Ignore storage errors (e.g. private mode) and keep state in memory.
    }
  }, [viewMode]);

  const numberFormatter = useMemo(
    () => new Intl.NumberFormat(undefined, { notation: "standard" }),
    [],
  );
  const dateFormatter = useMemo(
    () =>
      new Intl.DateTimeFormat(undefined, {
        year: "numeric",
        month: "short",
        day: "2-digit",
      }),
    [],
  );

  const formatNumber = (value: number) =>
    numberFormatter.format(Math.round(value));

  const formatCompactCount = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "0";
    if (value < 1000) return formatNumber(value);
    if (value < 10000) {
      const kValue = value / 1000;
      const formatted =
        kValue >= 100
          ? Math.round(kValue).toString()
          : kValue.toFixed(1).replace(/\.0$/, "");
      return `${formatted}k`;
    }
    const wValue = value / 10000;
    const formatted =
      wValue >= 100
        ? Math.round(wValue).toString()
        : wValue.toFixed(1).replace(/\.0$/, "");
    return `${formatted}w`;
  };

  const formatChannelMetric = (value: number) => {
    return formatCompactCount(value);
  };

  const truncateText = (value: string, maxLength = 60) => {
    if (!value) return "";
    if (value.length <= maxLength) return value;
    return `${value.slice(0, maxLength).trimEnd()}...`;
  };

  const formatPublishedAt = (value: string) => {
    if (!value) return "-";
    const date = new Date(value);
    if (Number.isNaN(date.getTime())) return value;
    return dateFormatter.format(date);
  };

  const isCardView = viewMode === "card";
  const pageSize = PAGE_SIZE;
  const filteredVideos = useMemo(() => {
    const keyword = titleFilter.trim().toLowerCase();
    if (!keyword) return videos;
    return videos.filter((video) =>
      video.title?.toLowerCase().includes(keyword),
    );
  }, [titleFilter, videos]);
  const totalPages = Math.ceil(filteredVideos.length / pageSize);

  useEffect(() => {
    setCurrentPage(1);
  }, [channelName, videos, titleFilter]);

  useEffect(() => {
    if (totalPages === 0) {
      setCurrentPage(1);
      return;
    }
    setCurrentPage((previousPage) =>
      previousPage > totalPages ? totalPages : previousPage,
    );
  }, [totalPages]);

  const paginatedVideos = useMemo(() => {
    if (filteredVideos.length === 0) return [];
    const startIndex = (currentPage - 1) * pageSize;
    return filteredVideos.slice(startIndex, startIndex + pageSize);
  }, [currentPage, pageSize, filteredVideos]);

  const searchStateSnapshot = useMemo(
    () => channelVideosState,
    [channelVideosState],
  );

  const exportDisabled = videos.length === 0 || isLoading;
  const exportChannelName = channelMetadata?.title ?? channelName ?? "";

  const handleExport = (format: "csv" | "excel") => {
    if (exportDisabled) return;
    const payload = {
      videos,
      channelName: exportChannelName,
      includeHotComments: showHotComments,
    };

    if (format === "csv") {
      exportVideosToCsv(payload);
    } else {
      exportVideosToExcel(payload);
    }
  };

  const handleSubscribe = async () => {
    const channelId = channelVideosState.channelId?.trim();
    if (
      !channelId ||
      channelVideosState.isSubscribed ||
      channelVideosState.isSubscriptionLoading
    ) {
      return;
    }

    onSubscriptionChange?.({ isSubscriptionLoading: true });
    try {
      await apiFetch("/api/youtube/subscribe", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel_id: channelId }),
      });
      onSubscriptionChange?.({
        isSubscribed: true,
        isSubscriptionLoading: false,
      });
      toast.success("订阅成功");
    } catch (caught) {
      console.error("Subscribe request failed", caught);
      const message =
        caught instanceof ApiError
          ? caught.message || "订阅失败，请稍后重试。"
          : caught instanceof Error
            ? caught.message
            : "订阅失败，请稍后重试。";
      toast.error(message);
      onSubscriptionChange?.({ isSubscriptionLoading: false });
    }
  };

  const handleUnsubscribe = async () => {
    const channelId = channelVideosState.channelId?.trim();
    if (
      !channelId ||
      !channelVideosState.isSubscribed ||
      channelVideosState.isSubscriptionLoading
    ) {
      return;
    }

    onSubscriptionChange?.({ isSubscriptionLoading: true });
    try {
      const response = await apiFetch<{
        data?: { channelId?: string; unsubscribed?: boolean };
      }>("/api/youtube/subscribe", {
        method: "DELETE",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ channel_id: channelId }),
      });
      const unsubscribed =
        typeof response?.data?.unsubscribed === "boolean"
          ? response.data.unsubscribed
          : true;
      onSubscriptionChange?.({
        isSubscribed: false,
        isSubscriptionLoading: false,
      });
      toast.success(
        unsubscribed ? "取消订阅成功" : "尚未订阅该频道，已同步状态。",
      );
    } catch (caught) {
      console.error("Unsubscribe request failed", caught);
      const message =
        caught instanceof ApiError
          ? caught.message || "取消订阅失败，请稍后重试。"
          : caught instanceof Error
            ? caught.message
            : "取消订阅失败，请稍后重试。";
      toast.error(message);
      onSubscriptionChange?.({ isSubscriptionLoading: false });
    }
  };

  const handleTitleFilterChange = (event: ChangeEvent<HTMLInputElement>) => {
    setTitleFilter(event.target.value);
  };

  const paginationItems = useMemo(() => {
    if (totalPages <= 1) return [];

    const items: Array<
      | { type: "page"; page: number }
      | { type: "ellipsis"; key: "left" | "right" }
    > = [];

    if (totalPages <= 7) {
      return Array.from({ length: totalPages }, (_, index) => ({
        type: "page" as const,
        page: index + 1,
      }));
    }

    items.push({ type: "page", page: 1 });

    if (currentPage <= 4) {
      for (let page = 2; page <= Math.min(5, totalPages - 1); page += 1) {
        items.push({ type: "page", page });
      }
      items.push({ type: "ellipsis", key: "right" });
    } else if (currentPage >= totalPages - 3) {
      items.push({ type: "ellipsis", key: "left" });
      for (
        let page = Math.max(totalPages - 4, 2);
        page < totalPages;
        page += 1
      ) {
        items.push({ type: "page", page });
      }
    } else {
      items.push({ type: "ellipsis", key: "left" });
      for (let page = currentPage - 1; page <= currentPage + 1; page += 1) {
        items.push({ type: "page", page });
      }
      items.push({ type: "ellipsis", key: "right" });
    }

    items.push({ type: "page", page: totalPages });

    return items;
  }, [currentPage, totalPages]);

  const handlePreviousPage = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (currentPage <= 1) return;
    setCurrentPage((previousPage) => previousPage - 1);
  };

  const handleNextPage = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (totalPages === 0 || currentPage >= totalPages) return;
    setCurrentPage((previousPage) => previousPage + 1);
  };

  const handleDirectPageSelect = (
    event: MouseEvent<HTMLAnchorElement>,
    page: number,
  ) => {
    event.preventDefault();
    if (page === currentPage || page < 1 || page > totalPages) return;
    setCurrentPage(page);
  };

  if (!channelName) return null;

  let channelSummary: JSX.Element | null = null;
  if (isLoading && !channelMetadata) {
    channelSummary = (
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-baseline gap-2">
          <Skeleton className="h-6 w-48" />
          <Skeleton className="h-4 w-24" />
        </div>
        <Skeleton className="h-4 w-full max-w-2xl" />
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-4 w-32" />
        </div>
      </div>
    );
  } else if (channelMetadata) {
    const viewToggle = (
      <div className="inline-flex items-center gap-1 rounded-md border border-border/60 bg-muted/40 p-0.5">
        <Button
          type="button"
          variant={isCardView ? "ghost" : "secondary"}
          size="sm"
          className="h-8 gap-1 px-3 text-xs"
          onClick={() => setViewMode("table")}
          aria-pressed={viewMode === "table"}
        >
          <List className="h-4 w-4" aria-hidden="true" />
          表格
        </Button>
        <Button
          type="button"
          variant={isCardView ? "secondary" : "ghost"}
          size="sm"
          className="h-8 gap-1 px-3 text-xs"
          onClick={() => setViewMode("card")}
          aria-pressed={viewMode === "card"}
        >
          <LayoutGrid className="h-4 w-4" aria-hidden="true" />
          卡片
        </Button>
      </div>
    );

    const isSubscribed = Boolean(channelVideosState.isSubscribed);
    const subscriptionLabel = channelVideosState.isSubscriptionLoading
      ? "处理中..."
      : isSubscribed
        ? "取消订阅"
        : "订阅";
    const subscriptionIcon = channelVideosState.isSubscriptionLoading ? (
      <Loader2 className="h-4 w-4 animate-spin" aria-hidden="true" />
    ) : isSubscribed ? (
      <BellMinus className="h-4 w-4" aria-hidden="true" />
    ) : (
      <BellPlus className="h-4 w-4" aria-hidden="true" />
    );
    const subscribeButton = isSubscribed ? (
      <AlertDialog>
        <AlertDialogTrigger asChild>
          <Button
            type="button"
            size="sm"
            className="h-8 gap-1 px-3 text-xs"
            variant="destructive"
            disabled={channelVideosState.isSubscriptionLoading}
          >
            {subscriptionIcon}
            {subscriptionLabel}
          </Button>
        </AlertDialogTrigger>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>取消订阅该频道？</AlertDialogTitle>
            <AlertDialogDescription>
              取消后将无法接收该频道的更新通知，确认继续吗？
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>保持订阅</AlertDialogCancel>
            <AlertDialogAction
              type="button"
              onClick={(event) => {
                event.preventDefault();
                void handleUnsubscribe();
              }}
              disabled={channelVideosState.isSubscriptionLoading}
            >
              确认取消
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    ) : (
      <Button
        type="button"
        size="sm"
        className="h-8 gap-1 px-3 text-xs"
        variant="default"
        disabled={channelVideosState.isSubscriptionLoading}
        onClick={handleSubscribe}
      >
        {subscriptionIcon}
        {subscriptionLabel}
      </Button>
    );

    const exportButton = exportDisabled ? (
      <Button
        type="button"
        size="sm"
        variant="outline"
        className="h-8 gap-1 px-3 text-xs"
        disabled
      >
        <Download className="h-4 w-4" aria-hidden="true" />
        导出
      </Button>
    ) : (
      <HoverCard openDelay={100} closeDelay={150}>
        <HoverCardTrigger asChild>
          <Button
            type="button"
            size="sm"
            variant="outline"
            className="h-8 gap-1 px-3 text-xs"
          >
            <Download className="h-4 w-4" aria-hidden="true" />
            导出
          </Button>
        </HoverCardTrigger>
        <HoverCardContent side="bottom" align="end" className="w-40 p-2">
          <div className="grid gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start gap-2 px-2 text-xs"
              onClick={() => handleExport("csv")}
            >
              <FileText className="h-4 w-4" aria-hidden="true" />
              导出 CSV
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="justify-start gap-2 px-2 text-xs"
              onClick={() => handleExport("excel")}
            >
              <FileSpreadsheet className="h-4 w-4" aria-hidden="true" />
              导出 Excel
            </Button>
          </div>
        </HoverCardContent>
      </HoverCard>
    );

    channelSummary = (
      <div className="mb-4 space-y-3">
        <div className="flex flex-col gap-3 xl:flex-row xl:items-start xl:justify-between">
          <div className="flex min-w-[240px] flex-1 flex-col gap-2">
            <div className="flex flex-wrap items-baseline gap-2">
              <h2 className="text-lg font-semibold">{channelMetadata.title}</h2>
              <span className="text-sm text-muted-foreground">
                {channelMetadata.handle}
              </span>
            </div>
            {channelMetadata.description ? (
              <p className="text-sm text-muted-foreground">
                {channelMetadata.description}
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center justify-end gap-2">
            {viewToggle}
            {subscribeButton}
            {exportButton}
            {onRefresh ? (
              <Tooltip delayDuration={100}>
                <TooltipTrigger asChild>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon-sm"
                    className="rounded-full border border-border/70"
                    aria-label="刷新频道数据"
                    onClick={onRefresh}
                    disabled={isLoading}
                  >
                    <RefreshCw
                      className={isLoading ? "h-4 w-4 animate-spin" : "h-4 w-4"}
                    />
                  </Button>
                </TooltipTrigger>
                <TooltipContent side="bottom" className="text-xs">
                  刷新频道内容
                </TooltipContent>
              </Tooltip>
            ) : null}
          </div>
        </div>
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
            <span>
              视频数: {formatCompactCount(channelMetadata.videoCount)}
            </span>
            <span>
              订阅数: {formatChannelMetric(channelMetadata.subscriberCount)}
            </span>
            <span>
              总观看次数: {formatChannelMetric(channelMetadata.viewCount)}
            </span>
          </div>
          <div className="flex w-full flex-col gap-1 md:w-[380px]">
            <div className="relative">
              <Input
                value={titleFilter}
                onChange={handleTitleFilterChange}
                placeholder="输入视频标题进行筛选"
                className="h-9 pr-10"
              />
              {titleFilter ? (
                <button
                  type="button"
                  onClick={() => setTitleFilter("")}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1 text-muted-foreground transition hover:bg-muted"
                  aria-label="清除筛选"
                >
                  ×
                </button>
              ) : null}
            </div>
          </div>
        </div>
      </div>
    );
  } else if (!isLoading) {
    channelSummary = (
      <Empty className="mb-4 border border-dashed border-muted-foreground/40 bg-muted/10">
        <EmptyHeader>
          <EmptyTitle>未找到频道信息</EmptyTitle>
          <EmptyDescription>请确认频道地址是否正确后重试。</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  const hasChannelMetadata = Boolean(channelMetadata);
  const shouldSkipVideoSection =
    !hasChannelMetadata && error === "Channel or playlist not found";
  const isFiltered = Boolean(titleFilter.trim());
  const hasVideoData =
    hasChannelMetadata && !error && filteredVideos.length > 0;

  const pagination =
    totalPages > 1 ? (
      <Pagination className="mt-4">
        <PaginationContent>
          <PaginationItem>
            <PaginationPrevious
              href="#"
              onClick={handlePreviousPage}
              aria-disabled={currentPage === 1}
              className={
                currentPage === 1 ? "pointer-events-none opacity-50" : undefined
              }
            />
          </PaginationItem>
          {paginationItems.map((item, index) =>
            item.type === "ellipsis" ? (
              <PaginationItem key={`ellipsis-${item.key}-${index}`}>
                <PaginationEllipsis />
              </PaginationItem>
            ) : (
              <PaginationItem key={item.page}>
                <PaginationLink
                  href="#"
                  isActive={item.page === currentPage}
                  onClick={(event) => handleDirectPageSelect(event, item.page)}
                >
                  {item.page}
                </PaginationLink>
              </PaginationItem>
            ),
          )}
          <PaginationItem>
            <PaginationNext
              href="#"
              onClick={handleNextPage}
              aria-disabled={currentPage === totalPages}
              className={
                currentPage === totalPages
                  ? "pointer-events-none opacity-50"
                  : undefined
              }
            />
          </PaginationItem>
        </PaginationContent>
      </Pagination>
    ) : null;

  let bodyContent: JSX.Element | null = null;
  if (shouldSkipVideoSection) {
    bodyContent = null;
  } else if (error) {
    bodyContent = (
      <DataErrorState
        className="border border-dashed border-muted-foreground/40 bg-muted/10"
        title="频道数据加载失败"
        description={
          error === "Failed to load channel videos"
            ? "加载频道内容时发生错误，请稍后重试。"
            : error
        }
        actionLabel={onRefresh ? "重新加载" : undefined}
        onRetry={onRefresh}
      />
    );
  } else if (hasChannelMetadata && isLoading) {
    if (isCardView) {
      const skeletonCards = Array.from({ length: Math.min(pageSize, 5) }).map(
        (_, index) => (
          <Card key={`skeleton-card-${index}`} className="flex h-full flex-col">
            <CardHeader className="space-y-2">
              <Skeleton className="h-3 w-20" />
              <Skeleton className="h-5 w-full" />
            </CardHeader>
            <CardContent className="flex flex-1 flex-col gap-4">
              <Skeleton className="aspect-video w-full rounded-md" />
              <div className="grid grid-cols-3 gap-3">
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
                <Skeleton className="h-4 w-full" />
              </div>
            </CardContent>
            {showHotComments ? (
              <CardFooter className="flex flex-col items-start gap-2 border-t border-border/40 bg-muted/10 p-4">
                <Skeleton className="h-4 w-24" />
                <Skeleton className="h-4 w-full" />
              </CardFooter>
            ) : null}
          </Card>
        ),
      );

      bodyContent = (
        <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
          {skeletonCards}
        </div>
      );
    } else {
      const skeletonRows = Array.from({ length: Math.min(pageSize, 5) }).map(
        (_, index) => (
          <TableRow key={index}>
            <TableCell className="w-16 text-center text-sm text-muted-foreground">
              <Skeleton className="mx-auto h-4 w-8" />
            </TableCell>
            <TableCell className="w-28 whitespace-nowrap text-center text-sm text-muted-foreground">
              <Skeleton className="mx-auto h-4 w-20" />
            </TableCell>
            <TableCell className="max-w-[260px]">
              <div className="flex min-w-0 items-center gap-3">
                <Skeleton className="h-4 flex-1" />
                <Skeleton className="h-8 w-14 shrink-0" />
              </div>
            </TableCell>
            <TableCell className="w-24 text-center">
              <Skeleton className="mx-auto h-4 w-14" />
            </TableCell>
            <TableCell className="w-24 text-center">
              <Skeleton className="mx-auto h-4 w-14" />
            </TableCell>
            <TableCell className="w-24 text-center">
              <Skeleton className="mx-auto h-4 w-14" />
            </TableCell>
            {showHotComments ? (
              <TableCell className="text-left">
                <Skeleton className="h-4 w-64" />
              </TableCell>
            ) : null}
          </TableRow>
        ),
      );

      bodyContent = (
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">
                <Skeleton className="mx-auto h-3 w-8" />
              </TableHead>
              <TableHead className="w-28 text-center">
                <Skeleton className="h-3 w-16" />
              </TableHead>
              <TableHead className="max-w-[260px]">
                <Skeleton className="h-3 w-28" />
              </TableHead>
              <TableHead className="w-24 text-center">
                <Skeleton className="mx-auto h-3 w-14" />
              </TableHead>
              <TableHead className="w-24 text-center">
                <Skeleton className="mx-auto h-3 w-14" />
              </TableHead>
              <TableHead className="w-24 text-center">
                <Skeleton className="mx-auto h-3 w-14" />
              </TableHead>
              {showHotComments ? (
                <TableHead className="text-left">
                  <Skeleton className="h-3 w-32" />
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>{skeletonRows}</TableBody>
        </Table>
      );
    }
  } else if (hasVideoData) {
    const tableContent = (
      <>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-16 text-center">序号</TableHead>
              <TableHead className="w-32 text-center">发布时间</TableHead>
              <TableHead className="max-w-[260px] text-center">
                视频标题
              </TableHead>
              <TableHead className="w-24 text-center">观看</TableHead>
              <TableHead className="w-24 text-center">点赞</TableHead>
              <TableHead className="w-24 text-center">评论</TableHead>
              {showHotComments ? (
                <TableHead className="max-w-[320px] text-center">
                  热门评论
                </TableHead>
              ) : null}
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedVideos.map((video, index) => {
              if (!channelMetadata) return null;
              const absoluteIndex = (currentPage - 1) * pageSize + index + 1;
              let hotCommentCell: JSX.Element | null = null;
              if (showHotComments) {
                const commentTitle = video.topComment?.trim() ?? "";
                const hasCommentTitle = commentTitle.length > 0;
                const displayTitle = hasCommentTitle
                  ? truncateText(commentTitle)
                  : "暂无评论";

                hotCommentCell = (
                  <TableCell className="max-w-[320px] text-left text-sm text-muted-foreground">
                    <Tooltip>
                      <TooltipTrigger asChild>
                        <span className="block max-w-full truncate font-medium">
                          {displayTitle}
                        </span>
                      </TooltipTrigger>
                      <TooltipContent
                        side="top"
                        align="start"
                        className="max-w-sm break-words text-left"
                      >
                        {hasCommentTitle ? (
                          <>
                            <p>{commentTitle}</p>
                            <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                              <span className="flex items-center gap-1">
                                <ThumbsUp
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                {formatCompactCount(video.topCommentLikeCount)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                {formatCompactCount(video.topCommentReplyCount)}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p>{displayTitle}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                );
              }

              return (
                <TableRow key={video.id}>
                  <TableCell className="w-16 text-center text-sm text-muted-foreground">
                    {absoluteIndex}
                  </TableCell>
                  <TableCell className="w-32 whitespace-nowrap text-center text-sm text-muted-foreground">
                    {formatPublishedAt(video.publishedAt)}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <Link
                            to={`/detail/${video.id}`}
                            state={{
                              video,
                              channel: channelMetadata,
                              relatedVideos: videos
                                .filter((item) => item.id !== video.id)
                                .slice(0, 5),
                              searchState: searchStateSnapshot,
                              hotCommentsEnabled: showHotComments,
                              globalSearchEnabled: isGlobalSearchEnabled,
                            }}
                            className="min-w-0 flex-1 truncate font-medium text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                          >
                            {video.title}
                          </Link>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-sm break-words"
                        >
                          {video.title}
                        </TooltipContent>
                      </Tooltip>
                      {video.thumbnailUrl ? (
                        <Tooltip>
                          <TooltipTrigger asChild>
                            <a
                              href={`https://www.youtube.com/watch?v=${video.id}`}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="group inline-flex shrink-0"
                            >
                              <img
                                src={video.thumbnailUrl}
                                alt={`${video.title} 缩略图`}
                                loading="lazy"
                                className="h-8 w-14 rounded object-cover transition-transform duration-150 group-hover:scale-105"
                              />
                            </a>
                          </TooltipTrigger>
                          <TooltipContent
                            side="top"
                            align="end"
                            className="p-0"
                          >
                            <img
                              src={video.thumbnailUrl}
                              alt={`${video.title} 预览图`}
                              loading="lazy"
                              className="h-48 w-auto max-w-xs rounded-md border border-border/40 bg-background object-cover shadow-lg"
                            />
                          </TooltipContent>
                        </Tooltip>
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="w-24 text-center">
                    {formatCompactCount(video.viewCount)}
                  </TableCell>
                  <TableCell className="w-24 text-center">
                    {formatCompactCount(video.likeCount)}
                  </TableCell>
                  <TableCell className="w-24 text-center">
                    {formatCompactCount(video.commentCount)}
                  </TableCell>
                  {hotCommentCell}
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
      </>
    );

    const cardContent = (
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-5">
        {paginatedVideos.map((video) => {
          if (!channelMetadata) return null;
          const commentTitle = video.topComment?.trim() ?? "";
          const hasCommentTitle = commentTitle.length > 0;
          const displayTitle = hasCommentTitle
            ? truncateText(commentTitle)
            : "暂无评论";

          return (
            <Card
              key={video.id}
              className="group flex h-full flex-col border border-border/60 bg-card transition-all duration-300 ease-out hover:-translate-y-0.5 hover:border-border/40 hover:shadow-[0_18px_34px_-16px_rgba(15,23,42,0.35)] focus-within:-translate-y-0.5 focus-within:border-primary/50 focus-within:shadow-[0_18px_34px_-16px_rgba(15,23,42,0.4)]"
            >
              <CardHeader className="space-y-2">
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <span>发布时间</span>
                  <span>{formatPublishedAt(video.publishedAt)}</span>
                </div>
                <Tooltip>
                  <TooltipTrigger asChild>
                    <Link
                      to={`/detail/${video.id}`}
                      state={{
                        video,
                        channel: channelMetadata,
                        relatedVideos: videos
                          .filter((item) => item.id !== video.id)
                          .slice(0, 5),
                        searchState: searchStateSnapshot,
                        hotCommentsEnabled: showHotComments,
                        globalSearchEnabled: isGlobalSearchEnabled,
                      }}
                      className="line-clamp-2 text-sm font-semibold text-primary underline-offset-2 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2"
                    >
                      {video.title}
                    </Link>
                  </TooltipTrigger>
                  <TooltipContent
                    side="top"
                    align="start"
                    className="max-w-sm break-words"
                  >
                    {video.title}
                  </TooltipContent>
                </Tooltip>
              </CardHeader>
              <CardContent className="flex flex-1 flex-col gap-4">
                {video.thumbnailUrl ? (
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <a
                        href={`https://www.youtube.com/watch?v=${video.id}`}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="block overflow-hidden rounded-md border border-border/40"
                      >
                        <img
                          src={video.thumbnailUrl}
                          alt={`${video.title} 缩略图`}
                          loading="lazy"
                          className="aspect-video w-full object-cover transition-transform duration-150 hover:scale-105"
                        />
                      </a>
                    </TooltipTrigger>
                    <TooltipContent side="top" align="center" className="p-0">
                      <img
                        src={video.thumbnailUrl}
                        alt={`${video.title} 预览图`}
                        loading="lazy"
                        className="h-48 w-auto max-w-xs rounded-md border border-border/40 bg-background object-cover shadow-lg"
                      />
                    </TooltipContent>
                  </Tooltip>
                ) : null}
                <div className="grid grid-cols-3 gap-3 text-center text-sm">
                  <div className="rounded-md border border-border/40 bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">观看</p>
                    <p className="mt-1 font-semibold">
                      {formatCompactCount(video.viewCount)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/40 bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">点赞</p>
                    <p className="mt-1 font-semibold">
                      {formatCompactCount(video.likeCount)}
                    </p>
                  </div>
                  <div className="rounded-md border border-border/40 bg-muted/30 p-2">
                    <p className="text-xs text-muted-foreground">评论</p>
                    <p className="mt-1 font-semibold">
                      {formatCompactCount(video.commentCount)}
                    </p>
                  </div>
                </div>
              </CardContent>
              {showHotComments ? (
                <CardFooter className="flex flex-col items-start gap-2 border-t border-border/40 bg-muted/10 p-4">
                  <span className="text-xs font-semibold text-muted-foreground">
                    热门评论
                  </span>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <span className="max-w-full truncate text-sm font-medium text-foreground">
                        {displayTitle}
                      </span>
                    </TooltipTrigger>
                    <TooltipContent
                      side="top"
                      align="start"
                      className="max-w-sm break-words text-left"
                    >
                      {hasCommentTitle ? (
                        <>
                          <p>{commentTitle}</p>
                          <p className="mt-1 flex items-center gap-3 text-xs text-muted-foreground">
                            <span className="flex items-center gap-1">
                              <ThumbsUp
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              {formatCompactCount(video.topCommentLikeCount)}
                            </span>
                            <span className="flex items-center gap-1">
                              <MessageCircle
                                className="h-3 w-3"
                                aria-hidden="true"
                              />
                              {formatCompactCount(video.topCommentReplyCount)}
                            </span>
                          </p>
                        </>
                      ) : (
                        <p>{displayTitle}</p>
                      )}
                    </TooltipContent>
                  </Tooltip>
                </CardFooter>
              ) : null}
            </Card>
          );
        })}
      </div>
    );

    bodyContent = (
      <TooltipProvider delayDuration={100}>
        {isCardView ? cardContent : tableContent}
        {pagination}
      </TooltipProvider>
    );
  } else if (hasChannelMetadata) {
    bodyContent = (
      <Empty className="border border-dashed border-muted-foreground/40 bg-muted/10">
        <EmptyHeader>
          <EmptyTitle>
            {isFiltered ? "未找到匹配的视频" : "No videos found"}
          </EmptyTitle>
          <EmptyDescription>
            {isFiltered
              ? "请尝试调整筛选条件或输入其他关键字。"
              : "Try searching for a different channel or keyword."}
          </EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  }

  return (
    <div className="w-full rounded-lg border bg-background p-4 shadow-sm">
      {channelSummary}
      {bodyContent}
    </div>
  );
}

export default VideoList;
