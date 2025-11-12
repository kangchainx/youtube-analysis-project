import { WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

type DataErrorStateProps = {
  title?: string;
  description?: string;
  actionLabel?: string;
  onRetry?: () => void;
  className?: string;
};

export function DataErrorState({
  title = "服务器开小差了",
  description = "请稍后再试，或者点击下方按钮重新加载。",
  actionLabel = "重试",
  onRetry,
  className,
}: DataErrorStateProps) {
  return (
    <div
      className={cn(
        "flex flex-col items-center gap-3 rounded-lg border border-dashed border-border/80 px-6 py-12 text-center",
        className,
      )}
    >
      <WifiOff className="h-8 w-8" />
      <p className="text-base font-semibold text-foreground">{title}</p>
      <p className="text-sm text-muted-foreground">{description}</p>
      {onRetry ? (
        <Button variant="secondary" onClick={onRetry}>
          {actionLabel}
        </Button>
      ) : null}
    </div>
  );
}
