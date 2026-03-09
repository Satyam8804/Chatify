import AuthForm from "../components/AuthForm";
import AuthPage from "./AuthPage";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import { logger } from "../utils/logger";
import { useState } from "react";
const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();

  const [loading, setLoading] = useState(false);

  const handleLogin = async (data) => {
    try {
      setLoading(true)
      await login(data);
      navigate("/chat");
    } catch (error) {
      logger(error.message);
    }finally{
      setLoading(false)
    }
  };

  return (
    <AuthPage>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
        <AuthForm mode="login" onSubmit={handleLogin} loading={loading}/>
      </div>
    </AuthPage>
  );
};

export default Login;
