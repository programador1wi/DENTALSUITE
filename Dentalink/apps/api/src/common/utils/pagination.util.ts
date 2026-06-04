export type PaginationInput = {
  page?: number;
  pageSize?: number;
};

export function resolvePagination(input?: PaginationInput) {
  const parsedPage = Number(input?.page);
  const parsedPageSize = Number(input?.pageSize);
  const page = Number.isInteger(parsedPage) && parsedPage > 0 ? parsedPage : 1;
  const pageSizeRaw = Number.isInteger(parsedPageSize) && parsedPageSize > 0 ? parsedPageSize : 50;
  const pageSize = Math.min(100, pageSizeRaw);
  const skip = (page - 1) * pageSize;
  const take = pageSize;
  return { page, pageSize, skip, take };
}
