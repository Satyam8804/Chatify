import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import Loader from "../utils/Loader";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, appReady } = useAuth();

  if (!appReady) return <Loader />;

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
