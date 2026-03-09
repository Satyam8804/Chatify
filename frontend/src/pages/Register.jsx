import AuthForm from "../components/AuthForm";
import AuthPage from "./AuthPage";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { logger } from "../utils/logger";
const Register = () => {
  const navigate = useNavigate();
  const handleRegister = async (data) => {
    try {
      await api.post("/users/register-user", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
  
      navigate("/login");
    } catch (error) {
      logger(error.message);
    }
  };

  return (
    <AuthPage>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
        <AuthForm mode="register" onSubmit={handleRegister} />
      </div>
    </AuthPage>
  );
};

export default Register;
