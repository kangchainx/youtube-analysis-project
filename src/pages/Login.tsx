import { LoginForm } from "@/features/login/login-form";
import bgImage from "@/assets/images/login_background_image.png";
function Login() {
  return (
    <div
      className="relative flex min-h-svh w-full items-center justify-center bg-cover bg-center bg-no-repeat p-6 md:p-10"
      style={{
        backgroundImage: `url(${bgImage})`,
      }}
    >
      <div className="absolute inset-0 bg-black/40" />
      <div className="relative z-10 w-full max-w-sm">
        <div className="rounded-xl bg-white/90 p-6 shadow-lg backdrop-blur-sm dark:bg-neutral-900/85">
          <LoginForm />
        </div>
      </div>
    </div>
  );
}

export default Login;
