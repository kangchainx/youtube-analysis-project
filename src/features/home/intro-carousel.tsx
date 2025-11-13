import { cn } from "@/lib/utils";

type IntroCarouselProps = {
  className?: string;
};

const IntroCarousel = ({ className }: IntroCarouselProps) => {
  return (
    <section
      className={cn(
        "rounded-2xl border border-border/60 bg-card/60 p-6 shadow-sm backdrop-blur",
        className,
      )}
    >
      <div className="flex items-baseline justify-between">
        <h2 className="text-lg font-semibold text-foreground">能力速览</h2>
        <span className="text-xs text-muted-foreground">
          快速了解平台亮点
        </span>
      </div>
    </section>
  );
};

export default IntroCarousel;
