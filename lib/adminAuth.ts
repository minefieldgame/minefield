export const ADMIN_SESSION_KEY = "minefield:admin-authenticated";
export const ADMIN_COOKIE_NAME = "minefield_admin_session";
export const ADMIN_SESSION_VALUE = "minefield-admin-v1";

export function getAdminPassword() {
  return process.env.MINEFIELD_ADMIN_PASSWORD ?? "Yuki2026";
}
