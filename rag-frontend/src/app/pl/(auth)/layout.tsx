import { PublicRoutes } from "@/components/auth/PublicRoutes";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return <PublicRoutes>{children}</PublicRoutes>;
}
