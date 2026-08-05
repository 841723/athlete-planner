import { useAuth } from "./auth-context";
import { LoginPage } from "./login-page";
import { Loader2 } from "lucide-react";

export function AuthGate({ children }: { children: React.ReactNode }) {
  const { status } = useAuth();
  if (status === "loading") {
    return (
      <div className="flex min-h-screen items-center justify-center bg-dark-50">
        <Loader2 className="w-6 h-6 animate-spin text-gray-500" />
      </div>
    );
  }
  if (status === "anonymous") return <LoginPage />;
  return <>{children}</>;
}
