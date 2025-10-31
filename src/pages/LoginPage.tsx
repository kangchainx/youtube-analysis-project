import Login from "@/features/login/Login";
import LoginText from "@/features/login/LoginText";

function LoginPage() {
  return (
    <div className="flex min-h-svh flex-col items-stretch md:flex-row">
      <div className="flex flex-1 items-center justify-center bg-muted p-8">
        <LoginText />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Login />
      </div>
    </div>
  );
}

export default LoginPage;
