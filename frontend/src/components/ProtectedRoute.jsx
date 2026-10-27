import { Navigate } from "react-router-dom";
import { useAuth } from "../context/AuthContext";
import Spinner from "./Spinner";

// roles: allowed roles (e.g. ["creator","admin"]). adminOnly kept for the existing /admin routes.
// NOTE: this only controls what the UI shows - the backend enforces the same rules on every API call.
const ProtectedRoute = ({ children, adminOnly = false, roles }) => {
  const { user, loading } = useAuth();

  if (loading) return <Spinner full />;
  if (!user) return <Navigate to="/login" replace />;
  if (adminOnly && user.role !== "admin") return <Navigate to="/" replace />;
  if (roles && !roles.includes(user.role)) return <Navigate to="/" replace />;

  return children;
};

export default ProtectedRoute;
