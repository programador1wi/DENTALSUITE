import { OnlineSchedulingNav } from "../components/online-scheduling-nav";
import { SchedulesSettingsPage } from "../../schedules/pages/schedules-settings-page";

export function OnlineSchedulesTab() {
  return (
    <OnlineSchedulingNav>
      <SchedulesSettingsPage />
    </OnlineSchedulingNav>
  );
}
