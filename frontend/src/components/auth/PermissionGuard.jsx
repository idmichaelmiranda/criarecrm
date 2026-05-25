import { useAuth } from "../../contexts/AuthContext";

export function PermissionGuard({ permission, children, fallback = null }) {
  const { hasPermission } = useAuth();
  return hasPermission(permission) ? children : fallback;
}
