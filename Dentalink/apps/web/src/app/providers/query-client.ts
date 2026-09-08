import { QueryClient } from "@tanstack/react-query";

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      retry: (failureCount, error) => {
        const statusCode = error instanceof Error && "statusCode" in error ? Number(error.statusCode) : 500;
        return statusCode !== 401 && failureCount < 1;
      },
      staleTime: 1000 * 30,
      refetchOnWindowFocus: false
    },
    mutations: {
      retry: 0
    }
  }
});

export async function clearPrivateQueryState() {
  await queryClient.cancelQueries();
  queryClient.clear();
}
