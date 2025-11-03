import { useEffect, useMemo, useState } from "react";
import { useAuth } from "@/contexts/AuthContext";
import {
  fetchCurrentUserProfile,
  updateCurrentUserProfile,
  type UserProfile,
} from "@/lib/user-api";
import { ApiError } from "@/lib/api-client";
import { Button } from "@/components/ui/button";
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
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import {
  Avatar,
  AvatarFallback,
  AvatarImage,
} from "@/components/ui/avatar";
import { Spinner } from "@/components/ui/spinner";

type ProfileStatus =
  | { type: "idle" }
  | { type: "loading" }
  | { type: "error"; message: string }
  | { type: "success"; message: string };

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
  const { user, updateUser } = useAuth();
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [formState, setFormState] = useState({
    name: user?.name ?? "",
    avatar: resolveAvatarUrl(user ?? null),
  });
  const [status, setStatus] = useState<ProfileStatus>({ type: "loading" });
  const [isSaving, setIsSaving] = useState(false);

  const baselineProfile = useMemo<UserProfile | null>(() => {
    if (profile) return profile;
    return user ?? null;
  }, [profile, user]);

  const baselineName = baselineProfile?.name ?? "";
  const baselineAvatar = resolveAvatarUrl(baselineProfile);

  const avatarFallback = useMemo(() => {
    const source =
      baselineProfile?.name?.trim() ||
      baselineProfile?.email?.trim() ||
      "";
    return source ? source.slice(0, 2).toUpperCase() : "?";
  }, [baselineProfile]);

  useEffect(() => {
    let isMounted = true;
    setStatus({ type: "loading" });

    fetchCurrentUserProfile()
      .then((data) => {
        if (!isMounted) return;
        setProfile(data);
        setFormState({
          name: data.name ?? "",
          avatar: resolveAvatarUrl(data),
        });
        setStatus({ type: "idle" });
      })
      .catch((error) => {
        if (!isMounted) return;
        if (error instanceof ApiError) {
          setStatus({
            type: "error",
            message:
              error.message ||
              "无法获取个人信息。请稍后重试或联系管理员配置相关接口。",
          });
        } else if (error instanceof Error) {
          setStatus({ type: "error", message: error.message });
        } else {
          setStatus({
            type: "error",
            message: "获取个人信息失败，请稍后重试。",
          });
        }
      })
      .finally(() => {
        if (isMounted) {
          setStatus((previous) =>
            previous.type === "loading" ? { type: "idle" } : previous,
          );
        }
      });

    return () => {
      isMounted = false;
    };
  }, []);

  useEffect(() => {
    if (!profile) return;
    setFormState({
      name: profile.name ?? "",
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

  const handleReset = () => {
    setFormState({
      name: baselineName,
      avatar: baselineAvatar,
    });
    setStatus({ type: "idle" });
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
      const payload: Record<string, string | null> = {};

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
            error.message ||
            "保存失败，请确认后台已实现用户信息更新接口。",
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

  const infoRows: Array<{ label: string; value: string | boolean | null }> = [
    { label: "用户 ID", value: baselineProfile?.id ?? "" },
    { label: "邮箱", value: baselineProfile?.email ?? "" },
    {
      label: "邮箱是否验证",
      value: baselineProfile?.emailVerified ? "已验证" : "未验证",
    },
  ];

  const isLoading = status.type === "loading" && !baselineProfile;

  return (
    <div className="flex min-h-screen flex-col items-center bg-muted/30 px-4 py-10">
      <Card className="w-full max-w-3xl bg-card/90 shadow-xl backdrop-blur">
        <CardHeader>
          <CardTitle>个人信息</CardTitle>
          <CardDescription>
            查看并管理您的登录信息。如果需要修改额外字段，请联系管理员。
          </CardDescription>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex flex-col items-center gap-3 py-10 text-center text-sm text-muted-foreground">
              <Spinner className="size-6 text-primary" />
              <p>正在加载个人信息，请稍候…</p>
              <p className="text-xs">若长时间未响应，可刷新页面重新尝试。</p>
            </div>
          ) : (
            <form
              className="flex flex-col gap-8"
              onSubmit={handleSubmit}
              noValidate
            >
              {status.type === "error" && (
                <div className="rounded-md border border-destructive/30 bg-destructive/10 px-4 py-3 text-sm text-destructive">
                  {status.message}
                </div>
              )}
              {status.type === "success" && (
                <div className="rounded-md border border-emerald-300/60 bg-emerald-100/60 px-4 py-3 text-sm text-emerald-800">
                  {status.message}
                </div>
              )}

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
                </div>
                <div className="flex-1">
                  <FieldGroup>
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

              <div className="grid gap-3 rounded-lg border border-border/50 bg-background/60 p-4 md:grid-cols-2">
                {infoRows.map((row) => (
                  <div key={row.label} className="flex flex-col gap-1">
                    <span className="text-xs uppercase tracking-wide text-muted-foreground">
                      {row.label}
                    </span>
                    <span className="truncate text-sm text-foreground">
                      {String(row.value ?? "—")}
                    </span>
                  </div>
                ))}
              </div>

              <div className="flex flex-wrap items-center justify-end gap-3">
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleReset}
                  disabled={isSaving || !hasChanges}
                >
                  重置
                </Button>
                <Button type="submit" disabled={isSaving || !hasChanges}>
                  {isSaving ? "保存中..." : "保存修改"}
                </Button>
              </div>
            </form>
          )}
        </CardContent>
        <CardFooter className="justify-end text-xs text-muted-foreground">
          若需修改邮箱或其他登录方式，请联系管理员。
        </CardFooter>
      </Card>
    </div>
  );
}

export default ProfilePage;
