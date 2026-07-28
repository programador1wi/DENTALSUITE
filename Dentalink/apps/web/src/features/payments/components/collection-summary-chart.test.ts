import { createElement } from "react";
import { render, screen } from "@testing-library/react";
import {
  buildCollectionSummaryModel,
  CollectionSummaryTooltip,
  type CollectionChartPoint
} from "./collection-summary-chart";

describe("buildCollectionSummaryModel", () => {
  it("fills missing days without attributing derived amounts to them", () => {
    const model = buildCollectionSummaryModel({
      dateFrom: "2026-07-09T06:00:00.000Z",
      dateTo: "2026-07-19T05:59:59.999Z",
      total: 820,
      totalPayments: 3,
      averageTicket: 273.33,
      byDay: [
        { date: "2026-07-12", amount: 720, paymentsCount: 2 },
        { date: "2026-07-17", amount: 100, paymentsCount: 1 }
      ]
    });

    expect(model.periodDays).toBe(10);
    expect(model.activeDays).toBe(2);
    expect(model.days).toHaveLength(10);
    expect(model.days[0]).toEqual(
      expect.objectContaining({ date: "2026-07-09", amount: 0, paymentsCount: 0, share: 0 })
    );
    expect(model.days[3]).toEqual(
      expect.objectContaining({
        date: "2026-07-12",
        amount: 720,
        paymentsCount: 2
      })
    );
    expect(model.days[8]).toEqual(
      expect.objectContaining({ date: "2026-07-17", amount: 100, paymentsCount: 1 })
    );
    expect(model.averagePerDay).toBe(82);
    expect(model.days[6]).toEqual(
      expect.objectContaining({ date: "2026-07-15", amount: 0, paymentsCount: 0, share: 0 })
    );
    expect(model.peakDay).toEqual(expect.objectContaining({ date: "2026-07-12", amount: 720 }));
  });

  it("states that an empty day has no collection and hides inherited metrics", () => {
    const emptyDay: CollectionChartPoint = {
      date: "2026-07-15",
      amount: 0,
      paymentsCount: 0,
      averageTicket: 0,
      share: 0
    };

    render(
      createElement(CollectionSummaryTooltip, {
        active: true,
        payload: [{ payload: emptyDay }]
      })
    );

    expect(screen.getByText("Sin recaudación registrada")).toBeInTheDocument();
    expect(screen.queryByText("Acumulado")).not.toBeInTheDocument();
    expect(screen.queryByText("Tendencia 3 días")).not.toBeInTheDocument();
  });
});
