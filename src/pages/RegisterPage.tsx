import LoginText from "@/features/login/LoginText";
import Register from "@/features/register/Register";

function RegisterPage() {
  return (
    <div className="flex min-h-svh flex-col items-stretch md:flex-row">
      <div className="flex flex-1 items-center justify-center bg-muted p-8">
        <LoginText />
      </div>
      <div className="flex flex-1 items-center justify-center">
        <Register />
      </div>
    </div>
  );
}

export default RegisterPage;
