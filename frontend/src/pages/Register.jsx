import AuthForm from "../components/AuthForm";
import AuthPage from "./AuthPage";
import api from "../api/axios";
import { useNavigate } from "react-router-dom";
import { logger } from "../utils/logger";
import { useState } from "react";

const Register = () => {
  const navigate = useNavigate();
  const [loading, setLoading] = useState(false);

  const handleRegister = async (data) => {
    try {
      setLoading(true);
      await api.post("/users/register-user", data, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });
      navigate("/login");
    } catch (error) {
      logger(error.message);
    } finally {
      setLoading(false);
    }
  };

  return (
    <AuthPage>
      <div className="min-h-screen w-full flex items-center justify-center bg-gray-100">
        <AuthForm mode="register" onSubmit={handleRegister} loading={loading} />
      </div>
    </AuthPage>
  );
};

export default Register;
