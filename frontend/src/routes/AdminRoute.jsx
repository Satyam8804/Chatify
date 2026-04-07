import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";
import Loader from "../utils/Loader";

const AdminRoute = ({ children }) => {
  const { user, appReady } = useAuth();

  if (!appReady) return <Loader />;

  if (!user) return <Navigate to="/login" replace />;
  if (!user.isAdmin) return <Navigate to="/chat" replace />;

  return children;
};

export default AdminRoute;
