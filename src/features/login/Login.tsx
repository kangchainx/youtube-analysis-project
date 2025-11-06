import { LoginForm } from "@/components/login-form";
import { apiFetch, postJson, ApiError } from "@/lib/api-client";
import { useAuth, type AuthSessionPayload } from "@/contexts/AuthContext";
import { type FormEvent, useCallback, useEffect, useMemo, useState } from "react";
import { useNavigate, useLocation } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const registrationState = useMemo(() => {
    const state = (location.state ?? null) as {
      registeredEmail?: string;
      registrationSuccess?: string;
    } | null;
    return state ?? null;
  }, [location.state]);
  const { user, isHydrated, setSession } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoginLoading, setIsGoogleLoginLoading] = useState(false);
  const [isPasswordLoginLoading, setIsPasswordLoginLoading] = useState(false);
  const [infoMessage, setInfoMessage] = useState<string | null>(
    registrationState?.registrationSuccess ?? null,
  );
  const [prefilledEmail] = useState<string>(
    registrationState?.registeredEmail ?? "",
  );

  useEffect(() => {
    if (!isHydrated) return;
    if (user) {
      navigate("/home", { replace: true });
    }
  }, [isHydrated, navigate, user]);

  useEffect(() => {
    if (registrationState) {
      navigate(location.pathname, { replace: true, state: null });
    }
  }, [registrationState, navigate, location.pathname]);

  const handleLogin = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isPasswordLoginLoading) return;

      setError(null);
      setInfoMessage(null);

      const form = event.currentTarget;
      const formData = new FormData(form);
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "").trim();

      if (!email || !password) {
        setError("请输入邮箱和密码。");
        return;
      }

      setIsPasswordLoginLoading(true);

      try {
        const sessionPayload = await apiFetch<AuthSessionPayload>(
          "/api/auth/login/password",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              email,
              password,
            }),
          },
        );

        setSession({
          user: sessionPayload.user,
          token: sessionPayload.token,
          scope: sessionPayload.scope ?? null,
          expiresIn: sessionPayload.expiresIn ?? null,
          state: sessionPayload.state,
        });

        form.reset();
        navigate("/home", { replace: true });
      } catch (caughtError) {
        if (caughtError instanceof ApiError) {
          const message =
            caughtError.status === 401
              ? "用户名或密码错误，请重试。"
              : caughtError.message || "登录失败，请稍后重试或联系管理员。";
          setError(message);
        } else if (caughtError instanceof Error) {
          setError(caughtError.message);
        } else {
          setError("登录失败，请稍后重试。");
        }
      } finally {
        setIsPasswordLoginLoading(false);
      }
    },
    [isPasswordLoginLoading, navigate, setSession],
  );

  const handleGoogleLogin = useCallback(async () => {
    setError(null);
    setIsGoogleLoginLoading(true);

    try {
      const response = await postJson<{
        authorizationUrl?: string;
      }>("/api/auth/google/init", {});

      const authorizationUrl = response?.authorizationUrl;
      if (!authorizationUrl) {
        throw new Error("Missing authorization URL from server response.");
      }

      if (typeof window !== "undefined") {
        window.location.assign(authorizationUrl);
      }
    } catch (caughtError) {
      if (caughtError instanceof ApiError) {
        setError(caughtError.message);
      } else if (caughtError instanceof Error) {
        setError(caughtError.message);
      } else {
        setError("Unable to start Google login. Please try again.");
      }
      setIsGoogleLoginLoading(false);
    }
  }, []);

  return (
    <div className="flex w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm
          onSubmit={handleLogin}
          error={error}
          onGoogleLogin={handleGoogleLogin}
          isGoogleLoginLoading={isGoogleLoginLoading}
          isPasswordLoginLoading={isPasswordLoginLoading}
          infoMessage={infoMessage}
          defaultEmail={prefilledEmail}
        />
      </div>
    </div>
  );
}

export default Login;
