import { Button } from "@/components/ui/button";
import { ApiError, apiFetch } from "@/lib/api-client";
import { useAuth, type AuthUser } from "@/contexts/AuthContext";
import { useEffect, useState } from "react";
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

  useEffect(() => {
    let isMounted = true;

    if (oauthError) {
      const description = oauthErrorDescription ?? "";
      setError(`Google 授权失败：${oauthError}${description ? `（${description}）` : ""}`);
      return () => {
        isMounted = false;
      };
    }

    if (!code) {
      setError("缺少授权码，无法继续完成登录。");
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

        const hasOpener =
          typeof window !== "undefined" &&
          window.opener &&
          window.opener !== window &&
          !window.opener.closed;

        if (hasOpener) {
          try {
            window.opener.postMessage(
              {
                type: "google-auth-success",
                payload: {
                  user: nextSession.user,
                  scope: nextSession.scope,
                },
              },
              window.location.origin,
            );
          } catch (error) {
            console.warn("Failed to notify opener window", error);
          }
          window.close();
          return;
        }

        navigate("/home", { replace: true });
      } catch (caughtError) {
        if (!isMounted) return;
        if (caughtError instanceof ApiError) {
          setError(caughtError.message);
        } else if (caughtError instanceof Error) {
          setError(caughtError.message);
        } else {
          setError("登录验证失败，请重试。");
        }
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

  return (
    <div className="flex min-h-screen items-center justify-center px-6 py-10">
      <div className="flex max-w-md flex-col items-center gap-4 text-center">
        {!error ? (
          <>
            <h1 className="text-2xl font-semibold">正在完成登录...</h1>
            <p className="text-muted-foreground text-sm">
              正在验证您的 Google 授权，请稍候。
            </p>
            <div className="mt-4 h-5 w-5 animate-spin rounded-full border-2 border-muted-foreground/50 border-t-primary" />
            {isSubmitting && (
              <p className="text-muted-foreground text-xs">
                该过程通常只需几秒钟。
              </p>
            )}
          </>
        ) : (
          <>
            <h1 className="text-2xl font-semibold">登录失败</h1>
            <p className="text-muted-foreground text-sm">{error}</p>
            <Button type="button" onClick={handleBackToLogin}>
              返回登录页
            </Button>
          </>
        )}
      </div>
    </div>
  );
}

export default AuthCallbackPage;
