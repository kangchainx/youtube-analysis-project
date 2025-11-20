import { Button } from "@/components/ui/button";
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { useCallback, useEffect, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";

type GoogleCallbackResponse = {
  user: AuthUser;
  token: string;
  scope: string | null;
  state?: string;
  expiresIn?: string | null;
};

function safeDecode(value: string | null) {
  if (!value) return null;
  try {
    return decodeURIComponent(value.replace(/\+/g, " "));
  } catch (error) {
    console.warn("Failed to decode OAuth parameter", error);
    return value;
  }
}

function AuthCallbackPage() {
  const [searchParams] = useSearchParams();
  const navigate = useNavigate();
  const { setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const code = searchParams.get("code");
  const stateParam = searchParams.get("state");
  const oauthError = safeDecode(searchParams.get("error"));
  const oauthErrorDescription = safeDecode(
    searchParams.get("error_description"),
  );

  const notifyOpener = useCallback(
    (type: string, payload?: Record<string, unknown>) => {
      if (typeof window === "undefined") return false;
      const opener = window.opener;
      if (!opener || opener === window || opener.closed) return false;
      try {
        opener.postMessage(
          {
            type,
            payload,
          },
          window.location.origin,
        );
        return true;
      } catch (postError) {
        console.warn("Failed to notify opener window", postError);
        return false;
      }
    },
    [],
  );

  useEffect(() => {
    let isMounted = true;

    if (oauthError) {
      const description = oauthErrorDescription ?? "";
      const message = `Google 授权失败：${oauthError}${
        description ? `（${description}）` : ""
      }`;
      if (isMounted) {
        setError(message);
        setIsSubmitting(false);
      }
      notifyOpener("google-auth-error", { message });
      return () => {
        isMounted = false;
      };
    }

    if (!code) {
      const message = "缺少授权码，无法继续完成登录。";
      if (isMounted) {
        setError(message);
        setIsSubmitting(false);
      }
      notifyOpener("google-auth-error", { message });
      return () => {
        isMounted = false;
      };
    }

    setIsSubmitting(true);

    (async () => {
      try {
        const formPayload = new URLSearchParams();
        formPayload.set("code", code);
        if (stateParam) {
          formPayload.set("state", stateParam);
        }

        const payload = await apiFetch<GoogleCallbackResponse>(
          "/api/auth/google/callback",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/x-www-form-urlencoded",
            },
            body: formPayload.toString(),
          },
        );

        if (!isMounted) return;

        const nextSession = {
          user: payload.user,
          token: payload.token,
          scope: payload.scope ?? null,
          expiresIn: payload.expiresIn ?? null,
          state: payload.state,
        };

        setSession(nextSession);

        const didNotify = notifyOpener("google-auth-success", {
          user: nextSession.user,
          scope: nextSession.scope,
        });

        if (didNotify) {
          window.close();
          return;
        }

        navigate("/home", { replace: true });
      } catch (caughtError) {
        if (!isMounted) return;
        const message =
          caughtError instanceof ApiError
            ? caughtError.message
            : caughtError instanceof Error
              ? caughtError.message
              : "登录验证失败，请重试。";

        setError(message);
        notifyOpener("google-auth-error", { message });
      } finally {
        if (isMounted) {
          setIsSubmitting(false);
        }
      }
    })();

    return () => {
      isMounted = false;
    };
  }, [
    code,
    navigate,
    oauthError,
    oauthErrorDescription,
    setSession,
    stateParam,
  ]);

  const handleBackToLogin = () => {
    navigate("/", { replace: true });
  };

  const handleCloseWindow = () => {
    if (typeof window !== "undefined") {
      window.close();
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-muted/40 px-4 py-10">
      <Card className="w-full max-w-md">
        <CardHeader>
          <CardTitle>{error ? "登录失败" : "正在完成登录"}</CardTitle>
          <CardDescription>
            {error
              ? "Google 授权未能完成，请确认授权窗口中的提示信息。"
              : "请保持此页面打开，授权完成后我们会自动跳转或关闭窗口。"}
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          {!error ? (
            <div className="flex flex-col items-center gap-3 py-6 text-center text-sm text-muted-foreground">
              <Spinner className="size-6 text-primary" />
              <p>正在验证您的 Google 授权，请稍候…</p>
              {isSubmitting ? (
                <p className="text-xs">
                  该过程通常只需片刻。若长时间无响应，可关闭此窗口重新尝试。
                </p>
              ) : null}
            </div>
          ) : (
            <>
              <div className="rounded-md border border-destructive/40 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                {error}
              </div>
              <p className="text-xs text-muted-foreground">
                您可以关闭此窗口，或返回登录页重新发起授权。
              </p>
            </>
          )}
        </CardContent>
        <CardFooter className="flex flex-col items-stretch gap-2 sm:flex-row sm:justify-end">
          {error ? (
            <>
              <Button variant="outline" onClick={handleCloseWindow}>
                关闭窗口
              </Button>
              <Button onClick={handleBackToLogin}>返回登录页</Button>
            </>
          ) : (
            <p className="w-full text-center text-xs text-muted-foreground">
              授权成功后窗口将自动关闭。
            </p>
          )}
        </CardFooter>
      </Card>
    </div>
  );
}

export default AuthCallbackPage;
