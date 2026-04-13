import { Routes, Route, Navigate } from "react-router-dom";
import { Toaster } from "react-hot-toast";

import ProtectedRoute from "./routes/ProtectedRoute";
import PublicRoute from "./routes/PublicRoute.jsx";

import Login from "./pages/Login";
import Register from "./pages/Register";
import Chat from "./pages/Chat.jsx";
import GoogleAuthSuccess from "./auth/google/success/GoogleAuthSuccess";
import AdminPanel from "./pages/Admin/AdminPanel.jsx";
import AdminRoute from "./routes/AdminRoute.jsx";

import { useAuth } from "./context/authContext";
import { useNavigate } from "react-router-dom";
import { useEffect } from "react";
import AdminAppeals from "./pages/Admin/AdminAppeals.jsx";
import BannedPage from "./pages/BannedPage.jsx";
import BackgroundManager from "./components/background/BackgroundManager.jsx";

function App() {
  const { user, appReady } = useAuth();
  const navigate = useNavigate();

  useEffect(() => {
    if (!appReady) return;

    const path = window.location.pathname;

    // ✅ If already on admin, don't override
    if (path.startsWith("/admin")) return;

    // 🔥 Role-based redirect
    if (user?.isAdmin) {
      navigate("/admin", { replace: true });
    } else if (user) {
      navigate("/chat", { replace: true });
    }
  }, [user, appReady]);
  return (
    <>
      <Toaster
        position="top-right"
        toastOptions={{
          duration: 3000,
          style: { background: "#1f2937", color: "#fff" },
        }}
      />

      <Routes>
        <Route
          path="/"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/login"
          element={
            <PublicRoute>
              <Login />
            </PublicRoute>
          }
        />
        <Route
          path="/register"
          element={
            <PublicRoute>
              <Register />
            </PublicRoute>
          }
        />

        <Route
          path="/chat"
          element={
            <ProtectedRoute>
              <Chat />
            </ProtectedRoute>
          }
        />

        {/* ✅ Admin panel */}
        <Route
          path="/admin"
          element={
            <AdminRoute>
              <AdminPanel />
            </AdminRoute>
          }
        />

        <Route
          path="/admin/appeals"
          element={
            <ProtectedRoute adminOnly>
              <AdminAppeals />
            </ProtectedRoute>
          }
        />

        <Route path="/banned" element={<BannedPage />} />

        <Route path="/auth/google/success" element={<GoogleAuthSuccess />} />
        <Route path="*" element={<Navigate to="/" replace />} />

        <Route
          path="/admin/backgrounds"
          element={
            <AdminRoute>
              <BackgroundManager />
            </AdminRoute>
          }
        />
      </Routes>
    </>
  );
}

export default App;
