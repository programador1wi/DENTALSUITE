import { useQuery } from "@tanstack/react-query";
import { http } from "@/lib/api/http-client";

export type OrthodonticMaterial = {
  id: string;
  name: string;
};

export type OrthodonticArchSize = {
  id: string;
  name: string;
};

export function useOrthodonticMaterials() {
  return useQuery({
    queryKey: ["clinical", "orthodontics", "materials"],
    queryFn: () => http.get<OrthodonticMaterial[]>("/clinical/orthodontics/materials").then((res: any) => res.data)
  });
}

export function useOrthodonticArchSizes() {
  return useQuery({
    queryKey: ["clinical", "orthodontics", "arch-sizes"],
    queryFn: () => http.get<OrthodonticArchSize[]>("/clinical/orthodontics/arch-sizes").then((res: any) => res.data)
  });
}
