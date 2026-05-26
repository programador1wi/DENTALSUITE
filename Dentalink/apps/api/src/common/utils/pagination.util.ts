export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export function resolvePagination(input?: PaginationInput) {
  const page = Number.isInteger(input?.page) && (input?.page ?? 0) > 0 ? (input?.page as number) : 1;
  const pageSizeRaw = Number.isInteger(input?.pageSize) && (input?.pageSize ?? 0) > 0 ? (input?.pageSize as number) : 50;
  const pageSize = Math.min(100, pageSizeRaw);
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}
