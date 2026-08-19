import type { PropsWithChildren } from "react";
import { Header } from "@/components/layout/header";

export function PrivateLayout({ children }: PropsWithChildren) {
  return (
    <div className="min-h-screen bg-[var(--bg-page)] text-[var(--text-primary)] flex flex-col">
      <a href="#main-content" className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-[9999] focus:rounded-md focus:bg-white focus:px-4 focus:py-2 focus:text-sm focus:font-semibold focus:shadow-lg">
        Saltar al contenido principal
      </a>
      <Header />
      <main id="main-content" className="mx-auto w-full min-w-0 max-w-[1536px] px-3 pb-6 pt-3 sm:px-5 sm:pb-8 sm:pt-4 lg:px-6">{children}</main>
    </div>
  );
}
