import { http } from "@/lib/api/http-client";

export type PermissionListItem = {
  id: string;
  key: string;
  code?: string | null;
  name: string;
  description?: string | null;
  module: string;
  action?: string | null;
  resource?: string | null;
  isActive: boolean;
  label?: string;
  businessGroup?: string;
  presentationTier?: "BASIC" | "ADVANCED" | "INTERNAL";
  delegable?: boolean;
  compatibilityAliasOf?: string | null;
  sensitive?: boolean;
};

export async function listPermissions(params?: { search?: string; module?: string; active?: string }) {
  const pageSize = 100;
  const results: PermissionListItem[] = [];

  for (let page = 1; page <= 10; page += 1) {
    const { data } = await http.get<PermissionListItem[]>("/permissions", {
      params: { ...params, page, pageSize }
    });

    results.push(...data);
    if (data.length < pageSize) break;
  }

  return results;
}
