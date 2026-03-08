import AuthForm from "../components/AuthForm";
import AuthPage from "./AuthPage";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../context/authContext";

const Login = () => {
  const { login } = useAuth();
  const navigate = useNavigate();
  const handleLogin = async (data) => {
    try {
      await login(data);
      navigate("/chat");
    } catch (error) {
      console.log(error.message);
    }
  };

  return (
    <AuthPage>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
        <AuthForm mode="login" onSubmit={handleLogin} />
      </div>
    </AuthPage>
  );
};

export default Login;
