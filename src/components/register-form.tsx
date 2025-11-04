import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Link } from "react-router-dom";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { AlertCircleIcon } from "lucide-react";

type RegisterFormProps = React.ComponentProps<"form"> & {
  error?: string | null;
  isSubmitting?: boolean;
};

export function RegisterForm({
  className,
  error,
  isSubmitting,
  children,
  ...props
}: RegisterFormProps) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">创建新账号</h1>
          <p className="text-muted-foreground text-sm text-balance">
            填写昵称、邮箱与密码，立即开始使用。
          </p>
        </div>
        {error ? (
          <Alert variant="destructive">
            <AlertCircleIcon />
            <AlertTitle>注册失败</AlertTitle>
            <AlertDescription>{error}</AlertDescription>
          </Alert>
        ) : null}
        <Field>
          <FieldLabel htmlFor="name">昵称</FieldLabel>
          <Input
            id="name"
            name="name"
            placeholder="请输入昵称"
            autoComplete="nickname"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="email">邮箱</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            autoComplete="email"
            required
          />
        </Field>
        <Field>
          <FieldLabel htmlFor="password">密码</FieldLabel>
          <Input
            id="password"
            name="password"
            type="password"
            placeholder="请输入密码"
            autoComplete="new-password"
            required
          />
          <FieldDescription>密码不少于 8 个字符。</FieldDescription>
        </Field>
        <Field>
          <FieldLabel htmlFor="confirmPassword">确认密码</FieldLabel>
          <Input
            id="confirmPassword"
            name="confirmPassword"
            type="password"
            placeholder="再次输入密码"
            autoComplete="new-password"
            required
          />
        </Field>
        <Field>
          <Button
            type="submit"
            disabled={isSubmitting}
            aria-busy={isSubmitting}
          >
            {isSubmitting ? "正在创建..." : "注册"}
          </Button>
          <FieldDescription className="text-center">
            已有账号？{" "}
            <Link
              to="/"
              className="font-medium text-primary underline-offset-4 hover:underline"
            >
              前往登录
            </Link>
          </FieldDescription>
        </Field>
        {children}
      </FieldGroup>
    </form>
  );
}
