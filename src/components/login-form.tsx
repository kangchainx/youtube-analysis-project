import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";

type LoginFormProps = React.ComponentProps<"form"> & {
  error?: string | null;
  onGoogleLogin?: () => void;
  isGoogleLoginLoading?: boolean;
};

function GoogleIcon() {
  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      viewBox="0 0 24 24"
      className="h-4 w-4"
      aria-hidden="true"
      focusable="false"
    >
      <path
        fill="#4285F4"
        d="M23.52 12.273c0-.851-.076-1.67-.218-2.455H12v4.646h6.476c-.279 1.5-1.126 2.773-2.398 3.628v3.017h3.867c2.266-2.083 3.575-5.153 3.575-8.836z"
      />
      <path
        fill="#34A853"
        d="M12 24c3.24 0 5.957-1.073 7.943-2.891l-3.867-3.017c-1.075.72-2.45 1.148-4.076 1.148-3.136 0-5.794-2.118-6.747-4.965H1.237v3.11A11.997 11.997 0 0012 24z"
      />
      <path
        fill="#FBBC05"
        d="M5.253 14.275A7.214 7.214 0 014.878 12c0-.79.137-1.555.375-2.275V6.616H1.237A11.997 11.997 0 000 12c0 1.94.463 3.773 1.237 5.384l4.016-3.109z"
      />
      <path
        fill="#EA4335"
        d="M12 4.75c1.76 0 3.34.605 4.585 1.794l3.439-3.44C17.953 1.21 15.236 0 12 0 7.347 0 3.35 2.69 1.237 6.616l4.016 3.109C6.206 6.878 8.864 4.75 12 4.75z"
      />
    </svg>
  );
}

export function LoginForm({
  className,
  error,
  onGoogleLogin,
  isGoogleLoginLoading,
  ...props
}: LoginFormProps) {
  return (
    <form className={cn("flex flex-col gap-6", className)} {...props}>
      <FieldGroup>
        <div className="flex flex-col items-center gap-1 text-center">
          <h1 className="text-2xl font-bold">Login to your account</h1>
          <p className="text-muted-foreground text-sm text-balance">
            Enter your email below to login to your account
          </p>
        </div>
        {error && (
          <Field>
            <FieldError>{error}</FieldError>
          </Field>
        )}
        <Field>
          <FieldLabel htmlFor="email">Email</FieldLabel>
          <Input
            id="email"
            name="email"
            type="email"
            placeholder="m@example.com"
            required
          />
        </Field>
        <Field>
          <div className="flex items-center">
            <FieldLabel htmlFor="password">Password</FieldLabel>
            <a
              href="#"
              className="ml-auto text-sm underline-offset-4 hover:underline"
            >
              Forgot your password?
            </a>
          </div>
          <Input id="password" name="password" type="password" required />
        </Field>
        <Field>
          <Button type="submit">Login</Button>
        </Field>
        <FieldSeparator>Or continue with</FieldSeparator>
        <Field>
          <Button
            variant="outline"
            type="button"
            onClick={onGoogleLogin}
            disabled={isGoogleLoginLoading}
            aria-busy={isGoogleLoginLoading}
          >
            <GoogleIcon />
            <span className="ml-2">
              {isGoogleLoginLoading ? "Redirecting..." : "Continue with Google"}
            </span>
          </Button>
          <FieldDescription className="text-center">
            Don&apos;t have an account?{" "}
            <a href="#" className="underline underline-offset-4">
              Sign up
            </a>
          </FieldDescription>
        </Field>
      </FieldGroup>
    </form>
  );
}
