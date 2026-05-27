import { Navigate } from "react-router-dom";
import { useAuth } from "../contexts/AuthContext";

export default function PrivateRoute({ children }) {
  const { user, hasCompany } = useAuth();
  if (!user) return <Navigate to="/login" />;
  if (!hasCompany) return <Navigate to="/onboarding" />;
  return children;
}
