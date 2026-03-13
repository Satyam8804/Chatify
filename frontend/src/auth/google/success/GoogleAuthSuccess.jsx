import { useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { useAuth } from "../../context/authContext";
import { Loader } from "lucide-react";

// This page lives at /auth/google/success
// Google → backend → redirects here with ?token=xxx
// We read the token, store it, then redirect to chat

const GoogleAuthSuccess = () => {
  const { loginWithToken } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    const params = new URLSearchParams(window.location.search);
    const token  = params.get("token");

    if (!token) {
      navigate("/login?error=oauth_failed");
      return;
    }

    // Hand token to auth context (same as normal login)
    loginWithToken(token).then(() => {
      navigate("/chat");
    }).catch(() => {
      navigate("/login?error=oauth_failed");
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