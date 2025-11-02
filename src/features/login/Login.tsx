import { LoginForm } from "@/components/login-form";
import { postJson, ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const { user, isHydrated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isGoogleLoginLoading, setIsGoogleLoginLoading] = useState(false);

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

  const handleGoogleLogin = useCallback(async () => {
    setError(null);
    setIsGoogleLoginLoading(true);
    let popup: Window | null = null;

    if (typeof window !== "undefined") {
      const width = 480;
      const height = 640;
      const dualScreenLeft = window.screenX ?? window.screenLeft ?? 0;
      const dualScreenTop = window.screenY ?? window.screenTop ?? 0;
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
      const left = dualScreenLeft + (screenWidth - width) / 2;
      const top = dualScreenTop + (screenHeight - height) / 2;

      const features = [
        `width=${Math.round(width)}`,
        `height=${Math.round(height)}`,
        `left=${Math.round(left)}`,
        `top=${Math.round(top)}`,
        "resizable=yes",
        "scrollbars=yes",
        "status=yes",
      ].join(",");

      popup = window.open("", "google-oauth-popup", features);
    }

    try {
      const response = await postJson<{
        authorizationUrl?: string;
      }>("/api/auth/google/init", {});

      const authorizationUrl = response?.authorizationUrl;
      if (!authorizationUrl) {
        throw new Error("Missing authorization URL from server response.");
      }

      if (popup && !popup.closed) {
        popup.location.href = authorizationUrl;
        popup.focus();
      } else {
        window.location.assign(authorizationUrl);
      }
    } catch (caughtError) {
      if (popup && !popup.closed) {
        popup.close();
      }
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
        />
      </div>
    </div>
  );
}

export default Login;
