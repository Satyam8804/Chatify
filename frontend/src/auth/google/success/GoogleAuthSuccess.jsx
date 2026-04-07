import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { Loader } from "lucide-react";
import { useAuth } from "../../../context/authContext";

const GoogleAuthSuccess = () => {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);

    const token = params.get("token");
    const error = params.get("error");

    // 🔴 Handle banned user (from backend redirect)
    if (error === "ACCOUNT_BANNED") {
      navigate("/banned", {
        replace: true,
        state: {
          userId: params.get("userId"),
          reason: params.get("reason"),
          bannedAt: params.get("bannedAt"),
          hasActiveAppeal: params.get("hasActiveAppeal") === "true",
        },
      });
      return;
    }

    // ❌ No token → fail
    if (!token) {
      navigate("/login?error=oauth_failed", { replace: true });
      return;
    }

    // ✅ Normal login flow
    loginWithToken(token)
      .then((res) => {
        const user = res?.user;

        // 🔥 SAME LOGIC AS NORMAL LOGIN
        if (user?.isAdmin) {
          navigate("/admin", { replace: true });
        } else {
          navigate("/chat", { replace: true });
        }
      })
      .catch(() => {
        navigate("/login?error=oauth_failed", { replace: true });
      });
  }, []);

  return (
    <div className="h-screen flex items-center justify-center bg-white dark:bg-slate-900">
      <div className="flex flex-col items-center gap-3 text-slate-500">
        <Loader className="animate-spin" size={32} />
        <p className="text-sm">Signing you in…</p>
      </div>
    </div>
  );
};

export default GoogleAuthSuccess;
