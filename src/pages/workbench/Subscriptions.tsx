import {
  type ChangeEvent,
  type FormEvent,
  type MouseEvent,
  useCallback,
  useEffect,
  useMemo,
  useState,
} from "react";
import { Button } from "@/components/ui/button";
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
  Pagination,
  PaginationContent,
  PaginationItem,
  PaginationNext,
  PaginationPrevious,
} from "@/components/ui/pagination";
import { cn } from "@/lib/utils";
import { Check, ChevronsUpDown } from "lucide-react";
import { Skeleton } from "@/components/ui/skeleton";
import { apiFetch, ApiError } from "@/lib/api-client";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
} from "@/components/ui/command";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";

type SubscriptionRecord = {
  id: string;
  channelId: string;
  channelName: string;
  handle: string;
  description: string;
  country: string;
  lastActive: string;
  customUrl?: string | null;
};

const PAGE_SIZE = 8;

const COUNTRY_OPTIONS = [
  { value: "", label: "全部国家" },
  { value: "CN", label: "中国" },
  { value: "US", label: "美国" },
  { value: "JP", label: "日本" },
  { value: "KR", label: "韩国" },
  { value: "GB", label: "英国" },
  { value: "DE", label: "德国" },
  { value: "FR", label: "法国" },
  { value: "CA", label: "加拿大" },
  { value: "AU", label: "澳大利亚" },
];

function SubscriptionsPage() {
  const FILTER_DEFAULTS = {
    channelId: "",
    customUrl: "",
    channelName: "",
    country: "",
  };

  const [offset, setOffset] = useState(0);
  const [subscriptions, setSubscriptions] = useState<SubscriptionRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [totalCount, setTotalCount] = useState<number | null>(null);
  const [hasNextPage, setHasNextPage] = useState(false);
  const [filterForm, setFilterForm] = useState(FILTER_DEFAULTS);
  const [activeFilters, setActiveFilters] = useState(FILTER_DEFAULTS);
  const [isCountryPickerOpen, setIsCountryPickerOpen] = useState(false);
  const currentPage = Math.floor(offset / PAGE_SIZE) + 1;
  const startIndex = offset;
  const selectedCountryOption =
    COUNTRY_OPTIONS.find((option) => option.value === filterForm.country) ??
    COUNTRY_OPTIONS[0];

  const fetchSubscriptions = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const searchParams = new URLSearchParams({
        limit: PAGE_SIZE.toString(),
        offset: offset.toString(),
      });
      const trimmedFilters = Object.fromEntries(
        Object.entries(activeFilters).map(([key, value]) => [
          key,
          value.trim(),
        ]),
      );
      if (trimmedFilters.channelId) {
        searchParams.set("channel_id", trimmedFilters.channelId);
      }
      if (trimmedFilters.customUrl) {
        searchParams.set("custom_url", trimmedFilters.customUrl);
      }
      if (trimmedFilters.channelName) {
        searchParams.set("channel_name", trimmedFilters.channelName);
      }
      if (trimmedFilters.country) {
        searchParams.set("country", trimmedFilters.country);
      }

      const response = await apiFetch<{
        data?: Array<{
          id: string;
          channelId?: string;
          customUrl?: string | null;
          channel?: {
            id?: string;
            title?: string;
            description?: string | null;
            customUrl?: string | null;
            country?: string | null;
            publishedAt?: string | null;
            thumbnailUrl?: string | null;
            lastSync?: string | null;
            subscriberCount?: number | null;
            videoCount?: number | null;
          } | null;
        }>;
        pagination?: { limit?: number; offset?: number; total?: number };
      }>(`/api/youtube/subscriptions?${searchParams.toString()}`);

      const records = Array.isArray(response?.data) ? response.data : [];

      const normalized = records.map<SubscriptionRecord>((record) => {
        const channel = record.channel ?? null;
        const title =
          channel?.title?.trim() ||
          record.customUrl?.trim() ||
          record.channelId ||
          "未命名频道";
        const handle = channel?.customUrl?.trim()?.length
          ? `@${channel.customUrl.replace(/^@/, "")}`
          : record.customUrl?.trim()
            ? `@${record.customUrl.replace(/^@/, "")}`
            : record.channelId ?? "-";
        const lastActive =
          channel?.lastSync ?? channel?.publishedAt ?? new Date().toISOString();

        return {
          id: record.id,
          channelId: record.channelId ?? channel?.id ?? "-",
          channelName: title,
          handle,
          description:
            channel?.description?.trim() ?? "该频道暂未提供描述信息。",
          country: channel?.country ?? "-",
          lastActive,
          customUrl: channel?.customUrl ?? record.customUrl ?? null,
        };
      });

      setSubscriptions(normalized);

      const totalFromApi = response?.pagination?.total;
      if (typeof totalFromApi === "number" && totalFromApi >= 0) {
        setTotalCount(totalFromApi);
        setHasNextPage(offset + normalized.length < totalFromApi);
      } else {
        const inferredTotal =
          normalized.length < PAGE_SIZE ? offset + normalized.length : null;
        if (inferredTotal !== null) {
          setTotalCount(inferredTotal);
        }
        setHasNextPage(normalized.length === PAGE_SIZE);
      }
    } catch (caught) {
      console.error("Failed to load subscriptions", caught);
      if (caught instanceof ApiError) {
        setError(
          caught.status === 401
            ? "登录已过期，请重新登录。"
            : caught.message || "获取订阅列表失败，请稍后重试。",
        );
      } else if (caught instanceof Error) {
        setError(caught.message);
      } else {
        setError("获取订阅列表失败，请稍后重试。");
      }
      setSubscriptions([]);
      setHasNextPage(false);
    } finally {
      setIsLoading(false);
    }
  }, [activeFilters, offset]);

  useEffect(() => {
    void fetchSubscriptions();
  }, [fetchSubscriptions]);

  const handleFilterInputChange = (event: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFilterForm((previous) => ({
      ...previous,
      [name]: value,
    }));
  };

  const handleApplyFilters = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setOffset(0);
    setActiveFilters({ ...filterForm });
  };

  const handleResetFilters = () => {
    setFilterForm(FILTER_DEFAULTS);
    setActiveFilters({ ...FILTER_DEFAULTS });
    setOffset(0);
  };

  const handleUnsubscribe = (record: SubscriptionRecord) => {
    console.info("Unsubscribe placeholder", record.channelId);
  };

  const handlePreviousPage = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (offset === 0) return;
    setOffset((previous) => Math.max(0, previous - PAGE_SIZE));
  };

  const handleNextPage = (event: MouseEvent<HTMLAnchorElement>) => {
    event.preventDefault();
    if (!hasNextPage) return;
    setOffset((previous) => previous + PAGE_SIZE);
  };

  const totalPages = useMemo(() => {
    if (typeof totalCount === "number" && totalCount >= 0) {
      return Math.max(1, Math.ceil(totalCount / PAGE_SIZE));
    }
    return hasNextPage ? currentPage + 1 : currentPage;
  }, [currentPage, hasNextPage, totalCount]);

  const totalLabel = typeof totalCount === "number" ? totalCount : "未知";

  return (
    <div className="space-y-6 p-6">
      <div className="rounded-lg border border-border/60 bg-card/70 p-4">
        <form
          className="flex flex-wrap items-end gap-3"
          onSubmit={handleApplyFilters}
        >
          <div className="flex w-full flex-col gap-1 sm:w-48">
            <span className="text-xs text-muted-foreground">频道ID</span>
            <Input
              name="channelId"
              placeholder="频道ID"
              value={filterForm.channelId}
              onChange={handleFilterInputChange}
            />
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-48">
            <span className="text-xs text-muted-foreground">频道标识</span>
            <Input
              name="customUrl"
              placeholder="频道标识"
              value={filterForm.customUrl}
              onChange={handleFilterInputChange}
            />
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-56">
            <span className="text-xs text-muted-foreground">频道名称</span>
            <Input
              name="channelName"
              placeholder="频道名称"
              value={filterForm.channelName}
              onChange={handleFilterInputChange}
            />
          </div>
          <div className="flex w-full flex-col gap-1 sm:w-40">
            <span className="text-xs text-muted-foreground">国家</span>
            <Popover
              open={isCountryPickerOpen}
              onOpenChange={setIsCountryPickerOpen}
            >
              <PopoverTrigger asChild>
                <Button
                  type="button"
                  variant="outline"
                  role="combobox"
                  aria-expanded={isCountryPickerOpen}
                  className="justify-between"
                >
                  {selectedCountryOption.label}
                  <ChevronsUpDown className="h-4 w-4 text-muted-foreground" />
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-56 p-0" align="start">
                <Command>
                  <CommandInput placeholder="搜索国家" />
                  <CommandEmpty>未找到国家</CommandEmpty>
                  <CommandGroup>
                    {COUNTRY_OPTIONS.map((option) => (
                      <CommandItem
                        key={option.value || "all"}
                        value={option.label}
                        onSelect={() => {
                          setFilterForm((previous) => ({
                            ...previous,
                            country: option.value,
                          }));
                          setIsCountryPickerOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            option.value === filterForm.country
                              ? "opacity-100"
                              : "opacity-0",
                          )}
                        />
                        {option.label}
                        {option.value ? ` (${option.value})` : " (全部)"}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </Command>
              </PopoverContent>
            </Popover>
          </div>
          <div className="flex gap-2">
            <Button
              type="button"
              variant="ghost"
              size="sm"
              onClick={handleResetFilters}
              disabled={isLoading}
            >
              重置
            </Button>
            <Button type="submit" size="sm" disabled={isLoading}>
              筛选
            </Button>
          </div>
        </form>
      </div>

      <div className="rounded-xl border border-border/80 bg-card shadow-sm">
        <div className="border-b border-border/80 px-6 py-4">
          <div className="flex flex-wrap items-center justify-between gap-4 text-sm text-muted-foreground">
            <div>
              共订阅{" "}
              <span className="font-medium text-foreground">{totalLabel}</span>{" "}
              个频道
            </div>
            <div>
              当前第{" "}
              <span className="font-medium text-foreground">{currentPage}</span>{" "}
              / {totalPages} 页
            </div>
          </div>
        </div>

        <div className="overflow-x-auto">
          <TooltipProvider>
          <Table>
            <TableHeader>
              <TableRow className="bg-muted/40">
                <TableHead className="w-[70px] text-center">序号</TableHead>
                <TableHead className="w-[240px] text-center">频道名称</TableHead>
                <TableHead className="min-w-[240px]">描述</TableHead>
                <TableHead className="w-[120px] text-center">国家</TableHead>
                <TableHead className="w-[120px] text-center">操作</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {isLoading ? (
                Array.from({ length: PAGE_SIZE }).map((_, index) => (
                  <TableRow key={`skeleton-${index}`} className="h-16">
                    <TableCell>
                      <Skeleton className="h-4 w-8" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-32" />
                      <Skeleton className="mt-2 h-3 w-24" />
                    </TableCell>
                    <TableCell>
                      <Skeleton className="h-4 w-48" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-4 w-16" />
                    </TableCell>
                    <TableCell className="text-center">
                      <Skeleton className="h-8 w-24" />
                    </TableCell>
                  </TableRow>
                ))
              ) : subscriptions.length > 0 ? (
                subscriptions.map((subscription, index) => (
                  <TableRow key={subscription.id} className="h-16">
                    <TableCell className="text-center text-sm font-medium text-muted-foreground">
                      {startIndex + index + 1}
                    </TableCell>
                    <TableCell className="text-center">
                      <div className="flex flex-col gap-1">
                        <span className="font-medium text-foreground">
                          {subscription.channelName}
                        </span>
                        <span className="text-xs text-muted-foreground">
                          {subscription.handle}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="text-sm text-muted-foreground">
                      <Tooltip>
                        <TooltipTrigger asChild>
                          <span className="block max-w-[420px] line-clamp-2">
                            {subscription.description}
                          </span>
                        </TooltipTrigger>
                        <TooltipContent
                          side="top"
                          align="start"
                          className="max-w-md break-words"
                        >
                          {subscription.description}
                        </TooltipContent>
                      </Tooltip>
                    </TableCell>
                    <TableCell className="text-sm text-center">
                      {subscription.country}
                    </TableCell>
                    <TableCell className="text-center">
                      <Button
                        type="button"
                        variant="outline"
                        size="sm"
                        onClick={() => handleUnsubscribe(subscription)}
                      >
                        退订
                      </Button>
                    </TableCell>
                  </TableRow>
                ))
              ) : (
                <TableRow>
                  <TableCell
                    colSpan={5}
                    className="py-12 text-center text-sm text-muted-foreground"
                  >
                    {error ?? "暂未订阅任何频道。"}
                  </TableCell>
                </TableRow>
              )}
            </TableBody>
          </Table>
          </TooltipProvider>
        </div>

        <div className="border-t border-border/80 px-4 py-3">
          <Pagination>
            <PaginationContent className="flex items-center justify-between">
              <PaginationItem>
                <PaginationPrevious
                  href="#"
                  onClick={handlePreviousPage}
                  aria-disabled={offset === 0 || isLoading}
                  className={cn(
                    offset === 0 || isLoading
                      ? "pointer-events-none opacity-50"
                      : undefined,
                  )}
                />
              </PaginationItem>
              <PaginationItem className="text-sm text-muted-foreground">
                第 {currentPage} / {totalPages} 页
              </PaginationItem>
              <PaginationItem>
                <PaginationNext
                  href="#"
                  onClick={handleNextPage}
                  aria-disabled={!hasNextPage || isLoading}
                  className={cn(
                    !hasNextPage || isLoading
                      ? "pointer-events-none opacity-50"
                      : undefined,
                  )}
                />
              </PaginationItem>
            </PaginationContent>
          </Pagination>
        </div>
      </div>
    </div>
  );
}

export default SubscriptionsPage;
