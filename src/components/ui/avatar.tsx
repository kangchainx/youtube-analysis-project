import * as React from "react";
import { cn } from "@/lib/utils";

type AvatarContextValue = {
  isImageLoaded: boolean;
  setImageLoaded: (value: boolean) => void;
};

const AvatarContext = React.createContext<AvatarContextValue | null>(null);

function useAvatarContext() {
  const context = React.useContext(AvatarContext);
  if (!context) {
    throw new Error("Avatar subcomponents must be used within <Avatar>");
  }
  return context;
}

export type AvatarProps = React.HTMLAttributes<HTMLDivElement>;

export const Avatar = React.forwardRef<HTMLDivElement, AvatarProps>(
  ({ className, children, ...props }, ref) => {
    const [isImageLoaded, setImageLoaded] = React.useState(false);

    const value = React.useMemo(
      () => ({
        isImageLoaded,
        setImageLoaded,
      }),
      [isImageLoaded],
    );

    return (
      <AvatarContext.Provider value={value}>
        <div
          ref={ref}
          className={cn(
            "relative flex h-10 w-10 shrink-0 overflow-hidden rounded-full border border-border/60 bg-muted",
            className,
          )}
          {...props}
        >
          {children}
        </div>
      </AvatarContext.Provider>
    );
  },
);
Avatar.displayName = "Avatar";

export type AvatarImageProps = React.ImgHTMLAttributes<HTMLImageElement>;

export const AvatarImage = React.forwardRef<HTMLImageElement, AvatarImageProps>(
  ({ className, onLoad, onError, ...props }, ref) => {
    const { setImageLoaded } = useAvatarContext();

    const handleLoad = (event: React.SyntheticEvent<HTMLImageElement>) => {
      setImageLoaded(true);
      onLoad?.(event as React.SyntheticEvent<HTMLImageElement>);
    };

    const handleError = (event: React.SyntheticEvent<HTMLImageElement>) => {
      setImageLoaded(false);
      onError?.(event as React.SyntheticEvent<HTMLImageElement>);
    };

    return (
      <img
        ref={ref}
        className={cn("h-full w-full object-cover", className)}
        onLoad={handleLoad}
        onError={handleError}
        {...props}
      />
    );
  },
);
AvatarImage.displayName = "AvatarImage";

export type AvatarFallbackProps = React.HTMLAttributes<HTMLSpanElement>;

export const AvatarFallback = React.forwardRef<
  HTMLSpanElement,
  AvatarFallbackProps
>(({ className, ...props }, ref) => {
  const { isImageLoaded } = useAvatarContext();

  return (
    <span
      ref={ref}
      className={cn(
        "absolute inset-0 flex items-center justify-center bg-muted text-sm font-medium text-muted-foreground",
        isImageLoaded ? "opacity-0" : "opacity-100",
        className,
      )}
      aria-hidden={isImageLoaded}
      {...props}
    />
  );
});
AvatarFallback.displayName = "AvatarFallback";

