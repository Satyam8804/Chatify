import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext.jsx";

const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();

  if (!loading && !isAuthenticated) return <Navigate to="/login" replace />; // ✅ not logged in → login

  return children; 
};

export default ProtectedRoute;
