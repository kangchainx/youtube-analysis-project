import { LoginForm } from "@/components/login-form";
import { type FormEvent, useState } from "react";
import { useNavigate } from "react-router-dom";

function Login() {
  const navigate = useNavigate();
  const [error, setError] = useState<string | null>(null);

  const handleLogin = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();

    const formData = new FormData(event.currentTarget);
    const email = formData.get("email");
    const password = formData.get("password");

    // TODO
    if (email === "kangchenhe666@gmail.com" && password === "123456a?") {
      navigate("/home");
    } else {
      setError("Invalid email or password. Please try again.");
    }
  };
  return (
    <div className="flex w-full items-center justify-center p-6 md:p-10">
      <div className="w-full max-w-sm">
        <LoginForm onSubmit={handleLogin} error={error} />
      </div>
    </div>
  );
}

export default Login;
