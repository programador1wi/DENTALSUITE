import { fireEvent, render, screen } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { TablePagination } from "./table-pagination";

describe("TablePagination", () => {
  it("announces the current page and preserves bounded navigation", () => {
    const onPageChange = vi.fn();

    render(
      <TablePagination
        page={2}
        totalPages={3}
        totalItems={24}
        itemLabel="solicitudes"
        onPageChange={onPageChange}
      />
    );

    expect(screen.getByText("24 solicitudes · Página 2 de 3")).toBeInTheDocument();
    fireEvent.click(screen.getByRole("button", { name: /anterior/i }));
    fireEvent.click(screen.getByRole("button", { name: /siguiente/i }));

    expect(onPageChange).toHaveBeenNthCalledWith(1, 1);
    expect(onPageChange).toHaveBeenNthCalledWith(2, 3);
  });
});
