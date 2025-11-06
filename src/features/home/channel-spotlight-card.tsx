import { useEffect, useRef, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { cn } from "@/lib/utils";
import { Check, Copy, ExternalLink } from "lucide-react";

export type ChannelSpotlight = {
  name: string;
  handle?: string | null;
  channelId?: string | null;
  description: string;
  totalViews: string;
  totalSubscribers: string;
  avatarUrl?: string | null;
};

type ChannelSpotlightCardProps = {
  spotlight: ChannelSpotlight;
  className?: string;
  onHoverChange?: (isHovering: boolean) => void;
};

const ChannelSpotlightCard = ({
  spotlight,
  className,
  onHoverChange,
}: ChannelSpotlightCardProps) => {
  const [isCopied, setIsCopied] = useState(false);
  const copyResetTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (copyResetTimeoutRef.current) {
        window.clearTimeout(copyResetTimeoutRef.current);
      }
    };
  }, []);

  const handleCopy = () => {
    if (!spotlight.handle) return;
    void navigator.clipboard
      .writeText(spotlight.handle)
      .then(() => {
        setIsCopied(true);
        if (copyResetTimeoutRef.current) {
          window.clearTimeout(copyResetTimeoutRef.current);
        }
        copyResetTimeoutRef.current = window.setTimeout(() => {
          setIsCopied(false);
        }, 2000);
      })
      .catch((error) => {
        console.error("复制频道 ID 失败", error);
      });
  };

  const handleVisit = () => {
    if (!spotlight.channelId) return;
    const youtubeUrl = `https://www.youtube.com/channel/${spotlight.channelId}`;
    window.open(youtubeUrl, "_blank", "noopener,noreferrer");
  };

  const handleMouseEnter = () => onHoverChange?.(true);
  const handleMouseLeave = () => onHoverChange?.(false);

  return (
    <Card
      className={cn(
        "group relative flex h-full w-[360px] flex-col justify-between overflow-hidden border-border/40 bg-card/95 shadow-lg transition-transform duration-300 hover:-translate-y-1",
        className,
      )}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
    >
      {spotlight.channelId ? (
        <div className="pointer-events-none absolute inset-0 bg-gradient-to-t from-black/70 via-black/35 to-transparent opacity-0 backdrop-blur-none transition-opacity duration-200 ease-out group-hover:opacity-100 group-hover:backdrop-blur-sm">
          <div className="pointer-events-auto flex h-full flex-col items-center justify-center gap-4 px-6 transition-transform duration-300 ease-out group-hover:-translate-y-1">
            <div className="flex items-center gap-4">
              <button
                type="button"
                onClick={handleCopy}
                className="flex items-center gap-2 rounded-full border border-white/60 bg-white/10 px-4 py-1.5 text-sm font-medium text-white transition-transform duration-200 hover:scale-105 hover:bg-white/20"
              >
                复制ID
                {isCopied ? (
                  <Check className="h-4 w-4" aria-hidden="true" />
                ) : (
                  <Copy className="h-4 w-4" aria-hidden="true" />
                )}
              </button>
              <button
                type="button"
                onClick={handleVisit}
                className="flex items-center gap-2 rounded-full border border-white/60 bg-white/10 px-4 py-1.5 text-sm font-medium text-white transition-transform duration-200 hover:scale-105 hover:bg-white/20"
              >
                在Youtube上打开
                <ExternalLink className="h-4 w-4" aria-hidden="true" />
              </button>
            </div>
          </div>
        </div>
      ) : null}
      <CardHeader className="space-y-4 p-6 pb-4">
        <div className="flex items-center gap-3">
          <Avatar className="size-12 border border-border/60">
            {spotlight.avatarUrl ? (
              <AvatarImage src={spotlight.avatarUrl} alt={spotlight.name} />
            ) : null}
            <AvatarFallback className="text-base font-semibold text-foreground">
              {spotlight.name.slice(0, 2).toUpperCase()}
            </AvatarFallback>
          </Avatar>
          <div className="flex flex-col">
            <div className="flex items-center">
              <CardTitle className="text-xl font-semibold text-foreground">
                {spotlight.name}
              </CardTitle>
              {spotlight.handle ? (
                <span className="ml-2 text-sm text-muted-foreground">
                  @{spotlight.handle.replace(/^@+/, "")}
                </span>
              ) : null}
            </div>
            <span className="text-xs text-muted-foreground">
              专注优质内容的创作者
            </span>
          </div>
        </div>
        <p className="text-sm leading-relaxed text-muted-foreground line-clamp-3">
          {spotlight.description}
        </p>
      </CardHeader>
      <CardContent className="flex flex-col gap-2 p-6 pt-0">
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-2 text-sm font-medium text-foreground">
          <span className="text-muted-foreground">总观看数</span>
          <span>{spotlight.totalViews}</span>
        </div>
        <div className="flex items-center justify-between rounded-lg border border-border/40 bg-muted/30 px-4 py-2 text-sm font-medium text-foreground">
          <span className="text-muted-foreground">总订阅数</span>
          <span>{spotlight.totalSubscribers}</span>
        </div>
      </CardContent>
    </Card>
  );
};

export default ChannelSpotlightCard;
