import type { PropsWithChildren } from "react";
import { CalendarDays, Gauge, List } from "lucide-react";
import { DentalinkPanel, ModuleTabs, type ModuleTab } from "@/components/layout/module-tabs";

const tabs: ModuleTab[] = [
  {
    to: "/settings/online-scheduling",
    label: "Agenda Online",
    icon: <CalendarDays className="h-3.5 w-3.5" />
  },
  {
    to: "/settings/online-scheduling/express",
    label: "Agenda Express",
    icon: <CalendarDays className="h-3.5 w-3.5" />
  },
  {
    to: "/settings/online-scheduling/campaigns",
    label: "Campanas",
    icon: <List className="h-3.5 w-3.5" />
  },
  {
    to: "/settings/online-scheduling/dashboard",
    label: "Dashboard",
    icon: <Gauge className="h-3.5 w-3.5" />
  }
];

export function OnlineSchedulingNav({ children }: PropsWithChildren) {
  return (
    <div className="mx-auto max-w-6xl space-y-4">
      <DentalinkPanel>
        <ModuleTabs tabs={tabs} />
        <div>{children}</div>
      </DentalinkPanel>
    </div>
  );
}
