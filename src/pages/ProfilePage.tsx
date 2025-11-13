import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchCurrentUserProfile,
  updateCurrentUserProfile,
  updateCurrentUserPassword,
  type UpdateUserProfileInput,
  type UserProfile,
} from "@/lib/user-api";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import {
  AlertCircleIcon,
  ArrowLeftIcon,
  CheckCircle2Icon,
  LockIcon,
} from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
  DialogClose,
} from "@/components/ui/dialog";
import { Alert, AlertDescription } from "@/components/ui/alert";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";
import { DataErrorState } from "@/components/ui/data-error-state";

type ProfileStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

type ProfileFormState = {
  name: string;
  email: string;
  avatar: string;
};

function resolveAvatarUrl(profile: UserProfile | null | undefined): string {
  if (!profile) return "";
  const { avatar, picture, avatarUrl, imageUrl } = profile as {
    avatar?: string | null;
    picture?: string | null;
    avatarUrl?: string | null;
    imageUrl?: string | null;
  };
  return (
    avatar?.trim() ||
    picture?.trim() ||
    avatarUrl?.trim() ||
    imageUrl?.trim() ||
    ""
  );
}

function ProfilePage() {
  const navigate = useNavigate();
  const { user, updateUser, clearSession } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formState, setFormState] = useState<ProfileFormState>({
    name: user?.name ?? "",
    email: user?.email ?? "",
    avatar: resolveAvatarUrl(user ?? null),
  });
  const [status, setStatus] = useState<ProfileStatus>({ type: "loading" });
  const [isSaving, setIsSaving] = useState(false);
  const [isPasswordDialogOpen, setIsPasswordDialogOpen] = useState(false);
  const [passwordStatus, setPasswordStatus] = useState<
    | { type: "idle" }
    | { type: "loading" }
    | { type: "error"; message: string }
    | { type: "success"; message: string }
  >({ type: "idle" });
  const [initialLoadError, setInitialLoadError] = useState<string | null>(null);
  const isMountedRef = useRef(true);
  const profileRequestIdRef = useRef(0);

  const baselineProfile = useMemo<UserProfile | null>(() => {
    if (profile) return profile;
    return user ?? null;
  }, [profile, user]);

  const baselineName = baselineProfile?.name ?? "";
  const baselineAvatar = resolveAvatarUrl(baselineProfile);

  const avatarFallback = useMemo(() => {
    const source =
      baselineProfile?.name?.trim() || baselineProfile?.email?.trim() || "";
    return source ? source.slice(0, 2).toUpperCase() : "?";
  }, [baselineProfile]);

  const isEmailPasswordUser = useMemo(() => {
    if (!baselineProfile) return false;
    const picture =
      (baselineProfile as { picture?: string | null })?.picture ?? null;
    const imageUrl =
      (baselineProfile as { imageUrl?: string | null })?.imageUrl ?? null;
    const googleAvatar =
      (baselineProfile as { avatarUrl?: string | null })?.avatarUrl ?? null;
    return ![picture, imageUrl, googleAvatar].some(
      (value) => typeof value === "string" && value.trim().length > 0,
    );
  }, [baselineProfile]);

  const fetchProfile = useCallback(async () => {
    profileRequestIdRef.current += 1;
    const requestId = profileRequestIdRef.current;

    setInitialLoadError(null);
    setStatus({ type: "loading" });

    try {
      const data = await fetchCurrentUserProfile();
      if (!isMountedRef.current || requestId !== profileRequestIdRef.current) {
        return;
      }
      setProfile(data);
      setFormState({
        name: data.name ?? "",
        email: data.email ?? "",
        avatar: resolveAvatarUrl(data),
      });
      setStatus({ type: "idle" });
    } catch (error) {
      if (!isMountedRef.current || requestId !== profileRequestIdRef.current) {
        return;
      }
      if (error instanceof ApiError) {
        const message =
          error.message ||
          "无法获取个人信息。请稍后重试或联系管理员配置相关接口。";
        setInitialLoadError(message);
        setStatus({
          type: "error",
          message,
        });
      } else if (error instanceof Error) {
        setInitialLoadError(error.message);
        setStatus({ type: "error", message: error.message });
      } else {
        const fallback = "获取个人信息失败，请稍后重试。";
        setInitialLoadError(fallback);
        setStatus({
          type: "error",
          message: fallback,
        });
      }
    } finally {
      if (isMountedRef.current && requestId === profileRequestIdRef.current) {
        setStatus((previous) =>
          previous.type === "loading" ? { type: "idle" } : previous,
        );
      }
    }
  }, []);

  useEffect(() => {
    void fetchProfile();
    return () => {
      isMountedRef.current = false;
    };
  }, [fetchProfile]);

  useEffect(() => {
    if (!profile) return;
    setFormState({
      name: profile.name ?? "",
      email: profile.email ?? "",
      avatar: resolveAvatarUrl(profile),
    });
  }, [profile]);

  const handleInputChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const { name, value } = event.target;
    setFormState((previous) => ({
      ...previous,
      [name]: value,
    }));
    setStatus((previous) =>
      previous.type === "success" ? { type: "idle" } : previous,
    );
  };

  const handlePasswordDialogOpenChange = (open: boolean) => {
    setIsPasswordDialogOpen(open);
    if (!open) {
      setPasswordStatus({ type: "idle" });
    }
  };

  const hasChanges =
    formState.name.trim() !== baselineName.trim() ||
    formState.avatar.trim() !== baselineAvatar.trim();

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!hasChanges) {
      setStatus({
        type: "error",
        message: "没有检测到需要更新的内容。",
      });
      return;
    }

    setIsSaving(true);
    setStatus({ type: "idle" });

    try {
      const payload: UpdateUserProfileInput = {};

      if (formState.name.trim() !== baselineName.trim()) {
        payload.name = formState.name.trim() || null;
      }

      if (formState.avatar.trim() !== baselineAvatar.trim()) {
        const trimmed = formState.avatar.trim();
        payload.avatar = trimmed || null;
      }

      const updatedProfile = await updateCurrentUserProfile(payload);
      setProfile(updatedProfile);
      updateUser(updatedProfile);
      setStatus({
        type: "success",
        message: "个人信息已保存。",
      });
    } catch (error) {
      if (error instanceof ApiError) {
        setStatus({
          type: "error",
          message:
            error.message || "保存失败，请确认后台已实现用户信息更新接口。",
        });
      } else if (error instanceof Error) {
        setStatus({ type: "error", message: error.message });
      } else {
        setStatus({
          type: "error",
          message: "保存失败，请稍后重试。",
        });
      }
    } finally {
      setIsSaving(false);
    }
  };

  const currentAvatarUrl = formState.avatar.trim() || baselineAvatar;

  const isInitialLoading = status.type === "loading" && !baselineProfile;
  const handleProfileRetry = useCallback(() => {
    if (!isMountedRef.current) return;
    void fetchProfile();
  }, [fetchProfile]);

  const handlePasswordSubmit = async (
    event: React.FormEvent<HTMLFormElement>,
  ) => {
    event.preventDefault();
    event.stopPropagation();
    if (passwordStatus.type === "loading") return;

    const form = event.currentTarget;
    const formData = new FormData(form);
    const currentPassword = String(
      formData.get("currentPassword") ?? "",
    ).trim();
    const password = String(formData.get("newPassword") ?? "").trim();
    const confirmPassword = String(
      formData.get("confirmPassword") ?? "",
    ).trim();

    if (!currentPassword || !password || !confirmPassword) {
      setPasswordStatus({ type: "error", message: "请完整填写所有字段。" });
      return;
    }

    if (password.length < 8) {
      setPasswordStatus({
        type: "error",
        message: "新密码长度至少需要 8 个字符。",
      });
      return;
    }

    if (password !== confirmPassword) {
      setPasswordStatus({
        type: "error",
        message: "两次输入的新密码不一致，请重新输入。",
      });
      return;
    }

    setPasswordStatus({ type: "loading" });

    try {
      const response = await updateCurrentUserPassword({
        currentPassword,
        password,
      });

      if (!response.success) {
        setPasswordStatus({
          type: "error",
          message: "密码更新失败，请稍后再试。",
        });
        return;
      }

      setPasswordStatus({
        type: "success",
        message: "密码已更新，下次登录时请使用新密码。",
      });
      form.reset();
      setIsPasswordDialogOpen(false);
      clearSession();
      navigate("/", { replace: true });
    } catch (error) {
      if (error instanceof ApiError) {
        setPasswordStatus({
          type: "error",
          message: error.message || "密码更新失败，请稍后再试。",
        });
      } else if (error instanceof Error) {
        setPasswordStatus({ type: "error", message: error.message });
      } else {
        setPasswordStatus({
          type: "error",
          message: "密码更新失败，请稍后再试。",
        });
      }
    }
  };

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-3xl bg-card/90 shadow-xl backdrop-blur">
        <CardHeader>
          <div className="flex items-start justify-between gap-4">
            <div>
              <CardTitle>个人信息</CardTitle>
            </div>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-1 flex items-center gap-2 text-sm"
              onClick={() => navigate(-1)}
            >
              <ArrowLeftIcon className="h-4 w-4" />
              返回
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {isInitialLoading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <Spinner className="size-6 text-primary" />
              <p>正在加载个人信息，请稍候…</p>
              <p className="text-xs">若长时间未响应，可刷新页面重新尝试。</p>
            </div>
          ) : !baselineProfile && initialLoadError ? (
            <div className="py-6">
              <DataErrorState
                title="无法加载个人信息"
                description={initialLoadError}
                actionLabel="重新加载"
                onRetry={handleProfileRetry}
              />
            </div>
          ) : (
            <>
              {initialLoadError ? (
                <DataErrorState
                  className="mb-6"
                  title="未能同步最新个人信息"
                  description={initialLoadError}
                  actionLabel="重新加载"
                  onRetry={handleProfileRetry}
                />
              ) : null}
              <form
                className="flex flex-col gap-8"
                onSubmit={handleSubmit}
                noValidate
              >
                {status.type === "error" && !initialLoadError && (
                  <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                    {status.message}
                  </div>
                )}
                {status.type === "success" && (
                  <div className="rounded-md border border-emerald-300/60 bg-emerald-100/60 px-4 py-3 text-sm text-emerald-800">
                    {status.message}
                  </div>
                )}

                {isEmailPasswordUser ? (
                  <div className="rounded-md border border-primary/30 bg-primary/10 px-4 py-3 text-sm text-primary">
                    您是通过邮箱注册的用户，因此此处不会显示任何 Google
                    账号相关信息。
                  </div>
                ) : null}

                <div className="flex flex-col gap-6 md:flex-row md:items-start">
                  <div className="flex flex-col items-center gap-3 md:w-56">
                    <Avatar className="h-24 w-24 border border-border/70 shadow-sm">
                      {currentAvatarUrl ? (
                        <AvatarImage src={currentAvatarUrl} alt="用户头像" />
                      ) : null}
                      <AvatarFallback className="text-lg font-semibold">
                        {avatarFallback}
                      </AvatarFallback>
                    </Avatar>
                    <p className="text-xs text-muted-foreground">
                      输入头像图片的 URL 地址后保存即可更新头像。
                    </p>
                    <Dialog
                      onOpenChange={handlePasswordDialogOpenChange}
                      open={isPasswordDialogOpen}
                    >
                      <DialogTrigger asChild>
                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          className="mt-2 flex items-center gap-2"
                        >
                          <LockIcon className="h-4 w-4" />
                          修改密码
                        </Button>
                      </DialogTrigger>
                      <DialogContent className="sm:max-w-md">
                        <DialogHeader>
                          <DialogTitle>修改密码</DialogTitle>
                          <DialogDescription>
                            更新登录密码后，下次登录请使用新密码。
                          </DialogDescription>
                        </DialogHeader>
                        <form
                          className="space-y-4"
                          onSubmit={handlePasswordSubmit}
                        >
                          <FieldGroup>
                            <Field>
                              <FieldLabel htmlFor="currentPassword">
                                当前密码
                              </FieldLabel>
                              <Input
                                id="currentPassword"
                                name="currentPassword"
                                type="password"
                                autoComplete="current-password"
                                placeholder="请输入当前密码"
                              />
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="newPassword">
                                新密码
                              </FieldLabel>
                              <Input
                                id="newPassword"
                                name="newPassword"
                                type="password"
                                autoComplete="new-password"
                                placeholder="请输入新密码"
                              />
                              <FieldDescription>
                                密码不少于 8 个字符。
                              </FieldDescription>
                            </Field>
                            <Field>
                              <FieldLabel htmlFor="confirmPassword">
                                确认新密码
                              </FieldLabel>
                              <Input
                                id="confirmPassword"
                                name="confirmPassword"
                                type="password"
                                autoComplete="new-password"
                                placeholder="再次输入新密码"
                              />
                            </Field>
                          </FieldGroup>

                          {passwordStatus.type === "error" ? (
                            <Alert variant="destructive">
                              <AlertCircleIcon />
                              {/* <AlertTitle>更新失败</AlertTitle> */}
                              <AlertDescription>
                                {passwordStatus.message}
                              </AlertDescription>
                            </Alert>
                          ) : null}
                          {passwordStatus.type === "success" ? (
                            <Alert>
                              <CheckCircle2Icon />
                              {/* <AlertTitle>更新成功</AlertTitle> */}
                              <AlertDescription>
                                {passwordStatus.message}
                              </AlertDescription>
                            </Alert>
                          ) : null}

                          <DialogFooter>
                            <DialogClose asChild>
                              <Button type="button" variant="outline">
                                取消
                              </Button>
                            </DialogClose>
                            <Button
                              type="submit"
                              disabled={passwordStatus.type === "loading"}
                            >
                              {passwordStatus.type === "loading"
                                ? "保存中..."
                                : "保存密码"}
                            </Button>
                          </DialogFooter>
                        </form>
                      </DialogContent>
                    </Dialog>
                  </div>
                  <div className="flex-1">
                    <FieldGroup>
                      <Field>
                        <FieldLabel htmlFor="email">邮箱</FieldLabel>
                        <Input
                          id="email"
                          name="email"
                          type="email"
                          placeholder="m@example.com"
                          value={formState.email}
                          readOnly
                          aria-readonly="true"
                          autoComplete="email"
                          className="bg-muted/40 text-muted-foreground"
                        />
                        <FieldDescription>
                          邮箱仅用于登录与通知，如需修改请联系管理员。
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="name">昵称</FieldLabel>
                        <Input
                          id="name"
                          name="name"
                          placeholder="请输入昵称"
                          value={formState.name}
                          onChange={handleInputChange}
                          disabled={isSaving}
                        />
                        <FieldDescription>
                          此昵称会显示在系统导航以及其他需要展示用户名的地方。
                        </FieldDescription>
                      </Field>
                      <Field>
                        <FieldLabel htmlFor="avatar">头像链接</FieldLabel>
                        <Input
                          id="avatar"
                          name="avatar"
                          placeholder="https://example.com/avatar.png"
                          value={formState.avatar}
                          onChange={handleInputChange}
                          disabled={isSaving}
                        />
                        <FieldDescription>
                          支持 PNG、JPG、SVG 等图片地址。留空则使用默认头像。
                        </FieldDescription>
                      </Field>
                    </FieldGroup>
                  </div>
                </div>

                <div className="flex flex-wrap items-center justify-end gap-3">
                  <Button type="submit" disabled={isSaving || !hasChanges}>
                    {isSaving ? "保存中..." : "保存修改"}
                  </Button>
                </div>
              </form>
            </>
          )}
        </CardContent>
        <CardFooter className="justify-end text-xs text-muted-foreground">
          更新后的密码会立即生效，如遇问题请联系管理员。
        </CardFooter>
      </Card>
    </div>
  );
}

export default ProfilePage;
