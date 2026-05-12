import { Routes, Route, Navigate, useLocation } from "react-router-dom";
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

// Routes where the back button should NOT exit the app
const MAIN_ROUTES = ["/chat", "/admin", "/admin/appeals", "/admin/backgrounds"];

function App() {
  const { user, appReady } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();

  // Role-based redirect on login
  useEffect(() => {
    if (!appReady) return;

    const path = window.location.pathname;

    // If already on admin, don't override
    if (path.startsWith("/admin")) return;

    if (user?.isAdmin) {
      navigate("/admin", { replace: true });
    } else if (user) {
      navigate("/chat", { replace: true });
    }
  }, [user, appReady]);

  // ✅ Android back button fix:
  // When the user is on a main screen, push a dummy history entry so
  // the back button has somewhere to go instead of closing the app.
  // On popstate (back press), we re-push to stay in the app, and
  // dispatch a custom event so child components (e.g. ChatLayout)
  // can react (e.g. close the active chat panel).
  useEffect(() => {
    const isMainRoute = MAIN_ROUTES.some((route) =>
      location.pathname.startsWith(route)
    );

    if (!isMainRoute) return;

    // Push a state so the browser has a history entry to "go back" to
    history.pushState({ chatify: true }, "", window.location.href);

    const handlePopState = (e) => {
      // Re-push to prevent the app from closing
      history.pushState({ chatify: true }, "", window.location.href);

      // Notify child components (ChatLayout listens to this)
      window.dispatchEvent(new CustomEvent("chatify:backpress"));
    };

    window.addEventListener("popstate", handlePopState);
    return () => window.removeEventListener("popstate", handlePopState);
  }, [location.pathname]);

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

        {/* Admin panel */}
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
