import AuthForm from "../components/AuthForm";
import AuthPage from "./AuthPage";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

import { useState } from "react";
import { logger } from "../utils/logger";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleLogin = async (data) => {
    try {
      setLoading(true);

      await login(data);

      navigate("/chat", { replace: true });
    } catch (error) {
      logger(error)
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPage>
      <AuthForm mode="login" onSubmit={handleLogin} loading={loading} />
    </AuthPage>
  );
};

export default Login;
