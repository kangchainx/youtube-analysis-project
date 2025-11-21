import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { Cable, Youtube } from "lucide-react";

import { Button } from "@/components/ui/button";
import {
  Empty,
  EmptyContent,
  EmptyDescription,
  EmptyHeader,
  EmptyMedia,
  EmptyTitle,
} from "@/components/ui/empty";
import { cn } from "@/lib/utils";

type YoutubeSetupVariant = "missingGoogle" | "missingChannel";

type YoutubeSetupNoticeProps = {
  variant: YoutubeSetupVariant;
  onRetry?: () => void;
  className?: string;
};

type VariantConfig = {
  icon: LucideIcon;
  title: string;
  description: ReactNode;
  actions?: Array<
    | { type: "link"; label: string; to: string }
    | { type: "external"; label: string; href: string }
  >;
};

const VARIANT_CONFIG: Record<YoutubeSetupVariant, VariantConfig> = {
  missingGoogle: {
    icon: Cable,
    title: "需要关联 Google 账号",
    description: (
      <>
        检测到您当前的账号尚未关联 Google 账号，无法获取 YouTube 数据。 请前往
        <Link to="/profile">Profile</Link> 页面关联 Google 账号后再试。
      </>
    ),
    actions: [
      { type: "link", label: "前往 账户页面进行 关联", to: "/profile" },
    ],
  },
  missingChannel: {
    icon: Youtube,
    title: "尚未创建 YouTube 频道",
    description: (
      <>
        已关联您的 Google 账号，但未检测到任何 YouTube
        频道。请先创建频道后再返回此页面刷新数据。
      </>
    ),
    actions: [
      {
        type: "external",
        label: "打开 YouTube Studio",
        href: "https://studio.youtube.com/",
      },
    ],
  },
};

export function YoutubeSetupNotice({
  variant,
  className,
}: YoutubeSetupNoticeProps) {
  const config = VARIANT_CONFIG[variant];
  const Icon = config.icon;

  return (
    <div className="flex justify-center">
      <Empty
        className={cn(
          "w-full max-w-4xl bg-card/70 text-center shadow-sm",
          className,
        )}
      >
        <EmptyHeader>
          <EmptyMedia variant="icon">
            <Icon className="h-5 w-5" />
          </EmptyMedia>
          <EmptyTitle>{config.title}</EmptyTitle>
          <EmptyDescription>{config.description}</EmptyDescription>
        </EmptyHeader>
        <EmptyContent>
          <div className="flex flex-wrap items-center justify-center gap-3">
            {config.actions?.map((action) => {
              if (action.type === "link") {
                return (
                  <Button key={action.label} asChild>
                    <Link to={action.to}>{action.label}</Link>
                  </Button>
                );
              }
              return (
                <Button key={action.label} asChild variant="outline">
                  <a href={action.href} target="_blank" rel="noreferrer">
                    {action.label}
                  </a>
                </Button>
              );
            })}
            {/* {onRetry ? (
              <Button variant="ghost" onClick={onRetry}>
                重新检测
              </Button>
            ) : null} */}
          </div>
        </EmptyContent>
      </Empty>
    </div>
  );
}
