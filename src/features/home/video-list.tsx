import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyDescription,
  EmptyHeader,
  EmptyTitle,
} from "@/components/ui/empty";
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
import type { ChannelVideosState } from "@/features/home/search-input";
import { MessageCircle, RefreshCw, ThumbsUp } from "lucide-react";
import type { JSX, MouseEvent } from "react";
import { useEffect, useMemo, useState } from "react";

const PAGE_SIZE = 10;

interface VideoListProps {
  channelVideosState: ChannelVideosState;
  onRefresh?: () => void;
}

function VideoList({ channelVideosState, onRefresh }: VideoListProps) {
  const { channelName, channelMetadata, videos, isLoading, error } =
    channelVideosState;

  const [currentPage, setCurrentPage] = useState(1);

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

  const formatCount = (value: number) => numberFormatter.format(value);

  const formatChannelMetric = (value: number) => {
    if (!Number.isFinite(value) || value <= 0) return "0w";
    const wValue = value / 10000;
    const formatted =
      wValue >= 100
        ? Math.round(wValue).toString()
        : wValue.toFixed(2).replace(/\.?0+$/, "");
    return `${formatted}w`;
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

  const totalPages = Math.ceil(videos.length / PAGE_SIZE);

  useEffect(() => {
    setCurrentPage(1);
  }, [channelName, videos]);

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
    if (videos.length === 0) return [];
    const startIndex = (currentPage - 1) * PAGE_SIZE;
    return videos.slice(startIndex, startIndex + PAGE_SIZE);
  }, [currentPage, videos]);

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
    channelSummary = (
      <div className="mb-4 space-y-2">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-baseline gap-2">
            <h2 className="text-lg font-semibold">{channelMetadata.title}</h2>
            <span className="text-sm text-muted-foreground">
              {channelMetadata.handle}
            </span>
          </div>
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
        {channelMetadata.description ? (
          <p className="text-sm text-muted-foreground">
            {channelMetadata.description}
          </p>
        ) : null}
        <div className="flex flex-wrap gap-4 text-xs text-muted-foreground">
          <span>视频数: {formatCount(channelMetadata.videoCount)}</span>
          <span>
            订阅数: {formatChannelMetric(channelMetadata.subscriberCount)}
          </span>
          <span>
            总观看次数: {formatChannelMetric(channelMetadata.viewCount)}
          </span>
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
  const shouldRenderTable = hasChannelMetadata && !error && videos.length > 0;
  let bodyContent: JSX.Element | null = null;
  if (shouldSkipVideoSection) {
    bodyContent = null;
  } else if (error) {
    bodyContent = (
      <Empty className="border border-dashed border-muted-foreground/40 bg-muted/10">
        <EmptyHeader>
          <EmptyTitle>Failed to load videos</EmptyTitle>
          <EmptyDescription>{error}</EmptyDescription>
        </EmptyHeader>
      </Empty>
    );
  } else if (hasChannelMetadata && isLoading) {
    const skeletonRows = Array.from({ length: Math.min(PAGE_SIZE, 5) }).map(
      (_, index) => (
        <TableRow key={index}>
          <TableCell className="w-28 whitespace-nowrap text-center text-sm text-muted-foreground">
            <Skeleton className="h-4 w-20" />
          </TableCell>
          <TableCell className="max-w-[260px]">
            <div className="flex min-w-0 items-center gap-3">
              <Skeleton className="h-4 flex-1" />
              <Skeleton className="h-8 w-14 shrink-0" />
            </div>
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-16" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-16" />
          </TableCell>
          <TableCell className="text-center">
            <Skeleton className="mx-auto h-4 w-16" />
          </TableCell>
          <TableCell className="text-left">
            <Skeleton className="h-4 w-64" />
          </TableCell>
        </TableRow>
      ),
    );

    bodyContent = (
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead className="w-28 text-center">
              <Skeleton className="h-3 w-16" />
            </TableHead>
            <TableHead className="max-w-[260px]">
              <Skeleton className="h-3 w-28" />
            </TableHead>
            <TableHead className="text-center">
              <Skeleton className="mx-auto h-3 w-16" />
            </TableHead>
            <TableHead className="text-center">
              <Skeleton className="mx-auto h-3 w-16" />
            </TableHead>
            <TableHead className="text-center">
              <Skeleton className="mx-auto h-3 w-16" />
            </TableHead>
            <TableHead className="text-left">
              <Skeleton className="h-3 w-32" />
            </TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>{skeletonRows}</TableBody>
      </Table>
    );
  } else if (shouldRenderTable) {
    bodyContent = (
      <TooltipProvider delayDuration={100}>
        <Table>
          <TableHeader>
            <TableRow>
              <TableHead className="w-28 text-center">发布时间</TableHead>
              <TableHead className="max-w-[260px] text-center">
                视频标题
              </TableHead>
              <TableHead className="text-center">观看</TableHead>
              <TableHead className="text-center">点赞</TableHead>
              <TableHead className="text-center">评论</TableHead>
              <TableHead className="max-w-[320px] text-center">
                热门评论
              </TableHead>
            </TableRow>
          </TableHeader>
          <TableBody>
            {paginatedVideos.map((video) => {
              const commentTitle = video.topComment?.trim() ?? "";
              const hasCommentTitle = commentTitle.length > 0;
              const displayTitle = hasCommentTitle
                ? truncateText(commentTitle)
                : "暂无标题";

              return (
                <TableRow key={video.id}>
                  <TableCell className="w-28 whitespace-nowrap text-center text-sm text-muted-foreground">
                    {formatPublishedAt(video.publishedAt)}
                  </TableCell>
                  <TableCell className="max-w-[260px]">
                    <div className="flex min-w-0 items-center gap-3">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="min-w-0 flex-1 truncate font-medium">
                            {video.title}
                          </span>
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
                      ) : null}
                    </div>
                  </TableCell>
                  <TableCell className="text-center">
                    {formatCount(video.viewCount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatCount(video.likeCount)}
                  </TableCell>
                  <TableCell className="text-center">
                    {formatCount(video.commentCount)}
                  </TableCell>
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
                                {formatCount(video.topCommentLikeCount)}
                              </span>
                              <span className="flex items-center gap-1">
                                <MessageCircle
                                  className="h-3 w-3"
                                  aria-hidden="true"
                                />
                                {formatCount(video.topCommentReplyCount)}
                              </span>
                            </p>
                          </>
                        ) : (
                          <p>{displayTitle}</p>
                        )}
                      </TooltipContent>
                    </Tooltip>
                  </TableCell>
                </TableRow>
              );
            })}
          </TableBody>
        </Table>
        {totalPages > 1 && (
          <Pagination className="mt-4">
            <PaginationContent>
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={handlePreviousPage}
                  aria-disabled={currentPage === 1}
                  className={
                    currentPage === 1
                      ? "pointer-events-none opacity-50"
                      : undefined
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
                      onClick={(event) =>
                        handleDirectPageSelect(event, item.page)
                      }
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
        )}
      </TooltipProvider>
    );
  } else if (hasChannelMetadata) {
    bodyContent = (
      <Empty className="border border-dashed border-muted-foreground/40 bg-muted/10">
        <EmptyHeader>
          <EmptyTitle>No videos found</EmptyTitle>
          <EmptyDescription>
            Try searching for a different channel or keyword.
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
