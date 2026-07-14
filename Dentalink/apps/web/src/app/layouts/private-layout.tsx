import type { PropsWithChildren } from "react";
import { Header } from "@/components/layout/header";
import { LoadingState } from "@/components/feedback/loading-state";
import { ErrorState } from "@/components/feedback/error-state";
import { useAuthStore } from "@/stores/auth.store";
import { useMeQuery } from "@/features/auth/hooks/use-me";

export function PrivateLayout({ children }: PropsWithChildren) {
  const token = useAuthStore((state) => state.accessToken);
  const user = useAuthStore((state) => state.user);
  const me = useMeQuery(Boolean(token) && !user);

  if (me.isLoading) {
    return (
      <div className="p-5">
        <LoadingState message="Validando sesión..." />
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
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col">
      <Header />
      <main className="mx-auto w-full max-w-[1536px] min-w-0 px-4 pb-12 pt-8 sm:px-6 lg:px-8">
        {children}
      </main>
    </div>
  );
}
