import { LoginForm } from "@/components/login-form";
import { postJson, ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import {
  type FormEvent,
  useCallback,
  useEffect,
  useRef,
  useState,
} from "react";
import { useNavigate } from "react-router-dom";

const POPUP_NAME = "google-oauth-popup";

function Login() {
  const navigate = useNavigate();
  const { user, isHydrated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoginLoading, setIsGoogleLoginLoading] = useState(false);
  const [isPopupActive, setIsPopupActive] = useState(false);
  const popupRef = useRef<Window | null>(null);
  const popupMonitorRef = useRef<number | null>(null);
  const isAwaitingPopupResolutionRef = useRef(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (user) {
      navigate("/home", { replace: true });
    }
  }, [isHydrated, navigate, user]);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    setError("Password login is not available. Please continue with Google.");
  };

  const clearPopup = useCallback(() => {
    if (typeof window === "undefined") return;

    if (popupMonitorRef.current !== null) {
      window.clearInterval(popupMonitorRef.current);
      popupMonitorRef.current = null;
    }

    if (popupRef.current && !popupRef.current.closed) {
      try {
        popupRef.current.close();
      } catch (closeError) {
        console.warn("Failed to close popup window", closeError);
      }
    }

    popupRef.current = null;
    setIsPopupActive(false);
  }, []);

  const handleGoogleLogin = useCallback(async () => {
    setError(null);
    setIsGoogleLoginLoading(true);
    isAwaitingPopupResolutionRef.current = false;

    if (typeof window !== "undefined") {
      const width = 480;
      const height = 640;
      const screenLeft = window.screenX ?? window.screenLeft ?? 0;
      const screenTop = window.screenY ?? window.screenTop ?? 0;
      const screenWidth =
        window.innerWidth ??
        document.documentElement.clientWidth ??
        window.screen?.width ??
        width;
      const screenHeight =
        window.innerHeight ??
        document.documentElement.clientHeight ??
        window.screen?.height ??
        height;
      const left = screenLeft + (screenWidth - width) / 2;
      const top = screenTop + (screenHeight - height) / 2;

      const features = [
        `width=${Math.round(width)}`,
        `height=${Math.round(height)}`,
        `left=${Math.round(left)}`,
        `top=${Math.round(top)}`,
        "resizable=yes",
        "scrollbars=yes",
        "status=yes",
      ].join(",");

      const popup = window.open("", POPUP_NAME, features);
      popupRef.current = popup ?? null;

      if (popup && !popup.closed) {
        popup.document.write(
          "<!doctype html><html><head><title>Google 授权</title><style>body{margin:0;font-family:system-ui,sans-serif;background:#0f172a;color:#e2e8f0;display:flex;align-items:center;justify-content:center;height:100vh;} .loader{display:flex;flex-direction:column;align-items:center;gap:12px;} .spinner{width:36px;height:36px;border-radius:50%;border:4px solid rgba(148,163,184,0.4);border-top-color:#38bdf8;animation:spin 1s linear infinite;} @keyframes spin{to{transform:rotate(360deg);}}</style></head><body><div class='loader'><div class='spinner'></div><p>正在打开 Google 授权...</p></div></body></html>",
        );
        try {
          popup.focus();
        } catch (focusError) {
          console.warn("Failed to focus popup window", focusError);
        }
        setIsPopupActive(true);
        isAwaitingPopupResolutionRef.current = true;

        popupMonitorRef.current = window.setInterval(() => {
          const activePopup = popupRef.current;
          if (!activePopup || activePopup.closed) {
            if (popupMonitorRef.current !== null) {
              window.clearInterval(popupMonitorRef.current);
              popupMonitorRef.current = null;
            }
            const wasAwaiting = isAwaitingPopupResolutionRef.current;
            isAwaitingPopupResolutionRef.current = false;
            clearPopup();
            if (wasAwaiting) {
              setIsGoogleLoginLoading(false);
              setError("Google 登录窗口已关闭，请重新尝试。");
            }
          }
        }, 500);
      } else {
        popupRef.current = null;
      }
    }

    try {
      const response = await postJson<{
        authorizationUrl?: string;
      }>("/api/auth/google/init", {});

      const authorizationUrl = response?.authorizationUrl;
      if (!authorizationUrl) {
        throw new Error("Missing authorization URL from server response.");
      }

      if (popupRef.current && !popupRef.current.closed) {
        popupRef.current.location.href = authorizationUrl;
        try {
          popupRef.current.focus();
        } catch (focusError) {
          console.warn("Failed to focus popup window", focusError);
        }
      } else {
        isAwaitingPopupResolutionRef.current = false;
        setIsPopupActive(false);
        window.location.assign(authorizationUrl);
      }
    } catch (caughtError) {
      isAwaitingPopupResolutionRef.current = false;
      clearPopup();
      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("Unable to start Google login. Please try again.");
      }
      setIsGoogleLoginLoading(false);
    }
  }, [clearPopup]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const handleMessage = (event: MessageEvent) => {
      if (typeof window === "undefined") return;
      if (event.origin !== window.location.origin) return;

      const data = event.data as
        | { type?: string; payload?: { message?: string } }
        | null;
      if (!data || typeof data.type !== "string") return;

      if (data.type === "google-auth-success") {
        isAwaitingPopupResolutionRef.current = false;
        setIsGoogleLoginLoading(false);
        clearPopup();
        try {
          window.focus();
        } catch (focusError) {
          console.warn("Failed to focus parent window", focusError);
        }
      }

      if (data.type === "google-auth-error") {
        isAwaitingPopupResolutionRef.current = false;
        setIsGoogleLoginLoading(false);
        clearPopup();
        setError(
          data.payload?.message ??
            "Google 登录失败，请稍后重试或检查网络连接。",
        );
        try {
          window.focus();
        } catch (focusError) {
          console.warn("Failed to focus parent window", focusError);
        }
      }
    };

    window.addEventListener("message", handleMessage);
    return () => {
      window.removeEventListener("message", handleMessage);
    };
  }, [clearPopup]);

  useEffect(() => {
    return () => {
      isAwaitingPopupResolutionRef.current = false;
      clearPopup();
    };
  }, [clearPopup]);

  const isBlocking = isPopupActive && isGoogleLoginLoading;

  return (
    <div className="relative flex w-full items-center justify-center p-6 md:p-10">
      {isBlocking ? (
        <div className="pointer-events-auto fixed inset-0 z-50 flex items-center justify-center bg-background/80 backdrop-blur-sm">
          <div className="flex w-[min(90vw,320px)] flex-col items-center gap-3 rounded-lg border border-border/60 bg-card px-6 py-5 text-center shadow-xl">
            <div className="flex h-10 w-10 items-center justify-center rounded-full bg-primary/10 text-primary">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-5 w-5 animate-spin"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
              >
                <path d="M21 12a9 9 0 1 1-6.219-8.56" />
              </svg>
            </div>
            <h2 className="text-base font-semibold text-foreground">
              正在等待 Google 授权
            </h2>
            <p className="text-xs text-muted-foreground">
              请在弹出的授权窗口中完成登录。窗口关闭后主页面将自动恢复。
            </p>
          </div>
        </div>
      ) : null}
      <div className="w-full max-w-sm">
        <LoginForm
          onSubmit={handleLogin}
          error={error}
          onGoogleLogin={handleGoogleLogin}
          isGoogleLoginLoading={isGoogleLoginLoading}
        />
      </div>
    </div>
  );
}

export default Login;

