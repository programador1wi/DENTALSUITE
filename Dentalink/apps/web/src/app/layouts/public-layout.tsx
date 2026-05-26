import type { PropsWithChildren } from "react";

export function PublicLayout({ children }: PropsWithChildren) {
  return (
    <main className="relative flex min-h-screen items-center justify-center bg-zinc-50 p-4 sm:p-6">
      <div className="relative z-10 w-full flex justify-center">
        {children}
      </div>
    </main>
  );
}

