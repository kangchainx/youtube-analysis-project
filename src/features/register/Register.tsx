import { RegisterForm } from "@/components/register-form";
import { apiFetch, ApiError } from "@/lib/api-client";
import { useAuth } from "@/contexts/AuthContext";
import { type FormEvent, useCallback, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";

function Register() {
  const navigate = useNavigate();
  const { user, isHydrated } = useAuth();
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    if (!isHydrated) return;
    if (user) {
      navigate("/home", { replace: true });
    }
  }, [isHydrated, navigate, user]);

  const handleSubmit = useCallback(
    async (event: FormEvent<HTMLFormElement>) => {
      event.preventDefault();
      if (isSubmitting) return;
      setError(null);

      const form = event.currentTarget;
      const formData = new FormData(form);

      const name = String(formData.get("name") ?? "").trim();
      const email = String(formData.get("email") ?? "").trim();
      const password = String(formData.get("password") ?? "").trim();
      const confirmPassword = String(
        formData.get("confirmPassword") ?? "",
      ).trim();

      if (!name || !email || !password || !confirmPassword) {
        setError("请完整填写所有字段。");
        return;
      }

      if (password.length < 8) {
        setError("密码长度至少需要 8 个字符。");
        return;
      }

      if (password !== confirmPassword) {
        setError("两次输入的密码不一致，请重新确认。");
        return;
      }

      setIsSubmitting(true);

      try {
        const response = await apiFetch<{ success?: boolean }>(
          "/api/auth/register",
          {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
            },
            body: JSON.stringify({
              name,
              email,
              password,
            }),
          },
        );

        if (!response || response.success !== true) {
          throw new Error("注册接口未返回成功状态，请稍后再试。");
        }
        form.reset();
        navigate("/", {
          replace: true,
          state: {
            registeredEmail: email,
            registrationSuccess: "请使用邮箱密码登录。",
          },
        });
      } catch (caughtError) {
        if (caughtError instanceof ApiError) {
          const message =
            caughtError.status === 409
              ? "该邮箱已注册，请直接登录或找回密码。"
              : caughtError.message || "注册失败，请稍后再试。";
          setError(message);
        } else if (caughtError instanceof Error) {
          setError(caughtError.message);
        } else {
          setError("注册失败，请稍后再试。");
        }
      } finally {
        setIsSubmitting(false);
      }
    },
    [isSubmitting, navigate],
  );

  return (
    <div className="flex w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <RegisterForm
          onSubmit={handleSubmit}
          error={error}
          isSubmitting={isSubmitting}
        />
      </div>
    </div>
  );
}

export default Register;
