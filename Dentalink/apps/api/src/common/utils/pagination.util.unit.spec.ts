import { resolvePagination } from "./pagination.util";

describe("resolvePagination", () => {
  it("returns defaults when page and pageSize are missing", () => {
    expect(resolvePagination()).toEqual({
      page: 1,
      pageSize: 50,
      skip: 0,
      take: 50
    });
  });

  it("caps pageSize at 100", () => {
    expect(resolvePagination({ page: 2, pageSize: 1000 })).toEqual({
      page: 2,
      pageSize: 100,
      skip: 100,
      take: 100
    });
  });
});
