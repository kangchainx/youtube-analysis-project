import { cn } from "@/lib/utils";
import {
  Carousel,
  CarouselContent,
  CarouselItem,
  CarouselNext,
  CarouselPrevious,
} from "@/components/ui/carousel";

type Slide = {
  title: string;
  description: string;
};

const slides: Slide[] = [
  {
    title: "深挖频道数据",
    description: "输入频道即可极速生成核心指标，助你掌握内容表现。",
  },
  {
    title: "洞察热门评论",
    description: "自动聚合互动热度，快速找到观众关注的焦点问题。",
  },
  {
    title: "追踪增长机会",
    description: "结合趋势与关键字，及时捕捉下一个爆款方向。",
  },
];

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
      <Carousel className="relative mt-6 w-full">
        <CarouselContent>
          {slides.map((slide) => (
            <CarouselItem key={slide.title}>
              <div className="flex h-[260px] flex-col justify-between rounded-xl bg-muted/40 p-6 sm:h-[300px]">
                <div>
                  <p className="text-xs uppercase tracking-wider text-primary">
                    Feature
                  </p>
                  <h3 className="mt-2 text-xl font-semibold text-foreground">
                    {slide.title}
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                    {slide.description}
                  </p>
                </div>
                <span className="text-sm font-medium text-primary">
                  图片内容敬请期待
                </span>
              </div>
            </CarouselItem>
          ))}
        </CarouselContent>
        <CarouselPrevious className="left-2" />
        <CarouselNext className="right-2" />
      </Carousel>
    </section>
  );
};

export default IntroCarousel;
