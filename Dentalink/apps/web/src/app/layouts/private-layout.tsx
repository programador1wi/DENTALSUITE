import { useState, type PropsWithChildren } from "react";
import { Header } from "@/components/layout/header";
import { Sidebar } from "@/components/layout/sidebar";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useAuthStore } from "@/stores/auth.store";
import { useMeQuery } from "@/features/auth/hooks/use-me";

export function PrivateLayout({ children }: PropsWithChildren) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const me = useMeQuery(Boolean(token) && !user);

  if (me.isLoading) {
    return (
      <div className="p-5">
        <LoadingState message="Validando sesion..." />
      </div>
    );
  }

  if (me.isError) {
    return (
      <div className="p-5">
        <ErrorState message={me.error.message} />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[var(--bg-page)] p-[var(--space-2)] text-[var(--text-primary)] lg:flex lg:gap-[var(--space-3)] lg:p-[var(--space-3)]">
      <Sidebar mobileOpen={sidebarOpen} onMobileClose={() => setSidebarOpen(false)} />
      <div className="flex min-w-0 flex-1 flex-col gap-[var(--space-3)]">
        <Header onMenuClick={() => setSidebarOpen((value) => !value)} mobileOpen={sidebarOpen} />
        <main className="mx-auto w-full max-w-[1536px] px-[var(--space-2)] pb-[var(--space-6)] pt-[var(--space-3)] md:px-[var(--space-6)]">
          {children}
        </main>
      </div>
    </div>
  );
}
