import type { PropsWithChildren } from "react";
import { QueryClientProvider } from "@tanstack/react-query";
import { Toaster } from "sonner";
import { queryClient } from "./query-client";
import { SessionBootstrap } from "./session-bootstrap";

export function AppProviders({ children }: PropsWithChildren) {
  return (
    <QueryClientProvider client={queryClient}>
      <SessionBootstrap>{children}</SessionBootstrap>
      <Toaster position="top-right" richColors closeButton />
    </QueryClientProvider>
  );
}
