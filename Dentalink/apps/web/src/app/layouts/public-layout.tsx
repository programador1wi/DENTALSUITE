import type { PropsWithChildren } from "react";

export function PublicLayout({ children }: PropsWithChildren) {
  return (
    <main className="relative flex min-h-[100dvh] w-full min-w-0 items-center justify-center bg-[var(--bg-page)]">
      <div className="relative z-10 flex w-full justify-center">
        {children}
      </div>
    </main>
  );
}

