import { useEffect, type PropsWithChildren } from "react";
import { refreshSessionFromCookie } from "@/lib/api/http-client";
import { useAuthStore } from "@/stores/auth.store";

export function SessionBootstrap({ children }: PropsWithChildren) {
  const initialized = useAuthStore((state) => state.isSessionInitialized);
  const setInitialized = useAuthStore((state) => state.setSessionInitialized);

  useEffect(() => {
    if (initialized) return;
    void refreshSessionFromCookie().catch(() => {
      setInitialized(true);
    });
  }, [initialized, setInitialized]);

  if (!initialized) {
    return (
      <div className="flex min-h-screen items-center justify-center text-sm text-muted-foreground">
        Validando sesión...
      </div>
    );
  }

  return children;
}
