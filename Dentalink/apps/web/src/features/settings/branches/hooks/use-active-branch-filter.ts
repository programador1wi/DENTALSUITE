import { useCallback, useEffect, useState } from "react";
import { useBranchStore } from "@/stores/branch.store";

export function useActiveBranchFilter(initialBranchId = "") {
  const activeBranchId = useBranchStore((state) => state.activeBranchId);
  const setActiveBranchId = useBranchStore((state) => state.setActiveBranchId);
  const [branchId, setLocalBranchId] = useState(initialBranchId);

  useEffect(() => {
    if (activeBranchId && branchId !== activeBranchId) {
      setLocalBranchId(activeBranchId);
    }
  }, [activeBranchId, branchId]);

  const setBranchId = useCallback(
    (nextBranchId: string) => {
      setLocalBranchId(nextBranchId);
      if (nextBranchId) setActiveBranchId(nextBranchId);
    },
    [setActiveBranchId]
  );

  return {
    activeBranchId,
    branchId: branchId || activeBranchId,
    setBranchId
  };
}
