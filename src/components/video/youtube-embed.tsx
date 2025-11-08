import { useMemo, useState } from "react";
import { cn } from "@/lib/utils";

type YouTubeEmbedProps = {
  videoId?: string;
  title?: string;
  className?: string;
  posterUrl?: string;
};

const buildEmbedUrl = (videoId: string) => {
  const params = new URLSearchParams({
    rel: "0",
    modestbranding: "1",
    playsinline: "1",
  });
  return `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?${params.toString()}`;
};

const YouTubeEmbed = ({
  videoId,
  title,
  className,
  posterUrl,
}: YouTubeEmbedProps) => {
  const [isLoaded, setIsLoaded] = useState(false);

  const embedUrl = useMemo(() => {
    if (!videoId) return null;
    return buildEmbedUrl(videoId);
  }, [videoId]);

  if (!embedUrl) {
    return null;
  }

  return (
    <div
      className={cn(
        "relative aspect-video overflow-hidden rounded-xl border border-border/60 bg-black shadow-lg",
        className,
      )}
    >
      {!isLoaded ? (
        <>
          {posterUrl ? (
            <img
              src={posterUrl}
              alt={title ?? "视频封面"}
              className="absolute inset-0 h-full w-full object-cover blur-[1px]"
              loading="lazy"
            />
          ) : null}
          <div className="absolute inset-0 flex items-center justify-center bg-black/40">
            <div className="size-10 animate-spin rounded-full border-2 border-white/60 border-t-transparent" />
          </div>
        </>
      ) : null}
      <iframe
        src={embedUrl}
        title={title ?? "YouTube video player"}
        className="absolute inset-0 h-full w-full"
        allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture; web-share"
        allowFullScreen
        loading="lazy"
        onLoad={() => setIsLoaded(true)}
      />
    </div>
  );
};

export default YouTubeEmbed;
