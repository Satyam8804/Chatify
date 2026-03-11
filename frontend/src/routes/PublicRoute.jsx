import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext.jsx";
import Loader from "../utils/Loader.jsx";

const PublicRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (loading) return <Loader />;
  if (isAuthenticated) return <Navigate to="/chat" replace />; 

  return children; 
};

export default PublicRoute;