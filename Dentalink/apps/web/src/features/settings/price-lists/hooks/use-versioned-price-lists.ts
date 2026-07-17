import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import {
  createDraftVersion,
  createVersionedPriceList,
  deactivateVersionItem,
  getPriceListHistory,
  listVersionedPriceLists,
  listVersionItems,
  publishVersion,
  saveVersionItem,
  updateVersionItem,
  validateVersion,
  type CreateVersionedPriceListPayload,
  type PriceListVersionV2,
  type VersionedPriceList
} from "../services/versioned-price-lists.service";

const key = ["settings", "versioned-price-lists"];

export function useVersionedPriceLists(search: string, includeInactive: boolean) {
  return useQuery({ queryKey: [...key, search, includeInactive], queryFn: () => listVersionedPriceLists(search, includeInactive) });
}

export function useVersionItems(versionId?: string) {
  return useQuery({ queryKey: [...key, "items", versionId], queryFn: () => listVersionItems(versionId ?? ""), enabled: Boolean(versionId) });
}

export function usePriceListHistory(priceListId?: string, enabled = true) {
  return useQuery({
    queryKey: [...key, "history", priceListId],
    queryFn: () => getPriceListHistory(priceListId ?? ""),
    enabled: Boolean(priceListId) && enabled
  });
}

export function useVersionedPriceMutations() {
  const queryClient = useQueryClient();
  const invalidate = () => queryClient.invalidateQueries({ queryKey: key });
  return {
    createList: useMutation({ mutationFn: (payload: CreateVersionedPriceListPayload) => createVersionedPriceList(payload), onSuccess: invalidate }),
    createVersion: useMutation({ mutationFn: (list: VersionedPriceList) => createDraftVersion(list), onSuccess: invalidate }),
    saveItem: useMutation({ mutationFn: ({ versionId, payload }: { versionId: string; payload: Parameters<typeof saveVersionItem>[1] }) => saveVersionItem(versionId, payload), onSuccess: invalidate }),
    updateItem: useMutation({ mutationFn: ({ itemId, payload }: { itemId: string; payload: Parameters<typeof updateVersionItem>[1] }) => updateVersionItem(itemId, payload), onSuccess: invalidate }),
    deactivateItem: useMutation({ mutationFn: ({ itemId, expectedVersion }: { itemId: string; expectedVersion: number }) => deactivateVersionItem(itemId, expectedVersion), onSuccess: invalidate }),
    validate: useMutation({ mutationFn: (versionId: string) => validateVersion(versionId) }),
    publish: useMutation({ mutationFn: ({ version, changeSummary }: { version: PriceListVersionV2; changeSummary: string }) => publishVersion(version, changeSummary), onSuccess: invalidate })
  };
}
