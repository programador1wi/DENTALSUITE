import { useQuery } from "@tanstack/react-query";
import { useEffect } from "react";
import { me } from "../services/auth.service";
import type { AuthUser } from "@/types/auth";
import { useAuthStore } from "@/stores/auth.store";

export function useMeQuery(enabled = true) {
  const setUser = useAuthStore((state) => state.setUser);

  const query = useQuery<AuthUser, Error>({
    queryKey: ["auth", "me"],
    queryFn: me,
    enabled,
    staleTime: 1000 * 60
  });

  useEffect(() => {
    if (query.data) {
      setUser(query.data);
    }
  }, [query.data, setUser]);

  return query;
}
