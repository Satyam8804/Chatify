import { Navigate } from "react-router-dom";
import { useAuth } from "../context/authContext";


const ProtectedRoute = ({ children }) => {
  const { isAuthenticated, loading } = useAuth();


  if (loading) {
  return null; // 🔥 let HTML loader handle it
}

  if (!isAuthenticated) {
    return <Navigate to="/login" replace />;
  }

  return children;
};

export default ProtectedRoute;
