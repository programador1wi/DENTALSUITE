import { describe, it, expect } from "vitest";
import { render, screen } from "@testing-library/react";
import { ReceiptPrintStyles, PaymentReceiptDocument } from "./payment-receipt-document";
import type { Payment } from "../services/payments.service";

describe("ReceiptPrintStyles", () => {
  it("renders print stylesheet with correct margins and page settings", () => {
    const { container } = render(<ReceiptPrintStyles />);
    const styleEl = container.querySelector("style");
    expect(styleEl).toBeInTheDocument();
    
    const cssText = styleEl?.textContent ?? "";
    // Verify page margin is 0 (to hide browser headers/footers)
    expect(cssText).toContain("margin: 0;");
    // Verify body print margin is 14mm
    expect(cssText).toContain("margin: 14mm !important;");
    // Verify A4 portrait
    expect(cssText).toContain("size: A4 portrait;");
    // Verify @media print html/body reset
    expect(cssText).toContain("@media print");
    expect(cssText).toContain("min-height: calc(297mm - 28mm)");
    // Verify class settings
    expect(cssText).toContain(".receipt-shell");
    expect(cssText).toContain(".receipt-header");
    expect(cssText).toContain(".receipt-table");
  });
});

describe("PaymentReceiptDocument", () => {
  const mockPayment: Payment = {
    id: "pay-123",
    paymentNumber: "100135",
    branchId: "branch-abc",
    patientId: "patient-xyz",
    amount: "720.00",
    currency: "MXN",
    status: "ALLOCATED",
    paidAt: "2026-07-13T12:00:00.000Z",
    createdAt: "2026-07-13T12:00:00.000Z",
    patient: {
      id: "patient-xyz",
      firstName: "EDUARDO",
      lastName: "CHANONA",
      documentNumber: "TEST",
      birthDate: "2001-04-05T00:00:00.000Z",
      email: "eduardo@example.com",
      agreement: { id: "agr-1", name: "Convenio MetLife" }
    },
    branch: { id: "branch-abc", name: "Dental + Suc. León Valle" },
    paymentMethod: { id: "meth-1", name: "Depósito", type: "BANK_TRANSFER" },
    receiptBranding: {
      businessName: "Dental + Suc. Leon Valle",
      legalName: null,
      logoUrl: null,
      address: "Av. Leon 123, Guadalajara, Jalisco",
      phone: "+52 333 000 0000",
      email: "leon@example.com",
      website: null,
      privacyNoticeUrl: null,
      primaryColor: null,
      secondaryColor: null
    },
    receivedBy: { id: "user-1", firstName: "Dr.", lastName: "General" },
    breakdown: [
      {
        id: "bd-1",
        kind: "TREATMENT",
        detail: "Evaluación oral comprensión - Pieza 14 - Cara ALL",
        baseAmount: 720.00,
        paidAmount: 720.00,
        treatmentNumber: "820561",
        treatmentName: "PLAN DE TRATAMIENTO INICIAL",
        remainingAmount: 0
      }
    ],
    allocatedAmount: 720.00,
    unallocatedAmount: 0,
    allocations: [],
    refunds: [],
    treatmentRefs: [
      {
        id: "tr-1",
        number: "820561",
        name: "PLAN DE TRATAMIENTO INICIAL",
        procedures: ["Proc 1"]
      }
    ]
  };

  it("renders patient information and payment breakdown tables successfully", () => {
    render(<PaymentReceiptDocument payment={mockPayment} />);
    
    // Verify Header Brand & Branch
    expect(screen.getAllByText("Dental + Suc. León Valle").length).toBeGreaterThanOrEqual(1);
    
    // Verify Patient block details
    expect(screen.getByText("EDUARDO CHANONA")).toBeInTheDocument();
    expect(screen.getByText("Convenio MetLife")).toBeInTheDocument();
    
    // Verify Breakdown rows
    expect(screen.getByText(/Pieza completa/)).toBeInTheDocument();
    expect(screen.getAllByText("100135").length).toBeGreaterThanOrEqual(1); // Payment number in breakdown and transaction
    
    // Verify Transaction row and total
    expect(screen.getByText("Depósito")).toBeInTheDocument();
  });
});
