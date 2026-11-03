import type { PropsWithChildren } from "react";
import { CalendarClock, CalendarDays, Gauge, List } from "lucide-react";
import { WarnerSuitePanel, ModuleTabs, type ModuleTab } from "@/components/layout/module-tabs";

const tabs: ModuleTab[] = [
  {
    to: "/settings/online-scheduling/schedules",
    label: "Horarios",
    icon: <CalendarClock className="h-3.5 w-3.5" />
  }
];

export function OnlineSchedulingNav({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <WarnerSuitePanel>
        {tabs.length > 1 && <ModuleTabs tabs={tabs} />}
        <div>{children}</div>
      </WarnerSuitePanel>
    </div>
  );
}
