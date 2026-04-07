import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext.jsx";
import Loader from "../utils/Loader.jsx";

const PublicRoute = ({ children }) => {
  const { isAuthenticated, user, appReady } = useAuth();

  if (!appReady) return <Loader />;

  if (isAuthenticated) {
    return <Navigate to={user?.isAdmin ? "/admin" : "/chat"} replace />;
  }

  return children;
};

export default PublicRoute;
