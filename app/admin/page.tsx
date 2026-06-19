import type { Metadata } from "next";
import AdminDashboard from "@/components/admin/AdminDashboard";

export const metadata: Metadata = {
  title: "Minefield Admin",
  robots: { index: false, follow: false, nocache: true }
};

export default function AdminPage() {
  return <AdminDashboard environment={process.env.NODE_ENV} />;
}
