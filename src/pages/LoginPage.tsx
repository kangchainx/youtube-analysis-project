import Login from "@/features/login/Login";
import LoginText from "@/features/login/LoginText";
import loginIllustration from "@/assets/images/Knowledge-pana.svg";

function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-stretch md:flex-row">
      <div className="relative flex flex-1 flex-col items-center justify-center gap-10 overflow-hidden border border-border bg-card p-8 text-card-foreground md:border-0 md:border-r md:p-10">
        <img
          src={loginIllustration}
          alt="登录分析插画"
          className="relative z-10 w-full max-w-lg drop-shadow-2xl"
        />
        <div className="relative z-10 max-w-md text-balance text-center">
          <LoginText />
        </div>
      </div>
      <div className="flex flex-1 items-center justify-center bg-background px-6 py-10">
        <Login />
      </div>
    </div>
  );
}

export default LoginPage;
