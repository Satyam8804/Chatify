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

  const handleLogin = async (formData) => {
    try {
      setLoading(true);

      const res = await login(formData); // ✅ get response
      const user = res?.user;

      // 🔥 role-based redirect
      if (user?.isAdmin) {
        navigate("/admin", { replace: true });
      } else {
        navigate("/chat", { replace: true });
      }
    } catch (err) {
      const { data } = err.response;

      // ✅ Redirect banned users to appeal page
      if (data?.code === "ACCOUNT_BANNED") {
        navigate("/banned", {
          state: {
            userId: data.userId,
            reason: data.reason,
            bannedAt: data.bannedAt,
            hasActiveAppeal: data.hasActiveAppeal,
          },
        });
        return;
      }
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
