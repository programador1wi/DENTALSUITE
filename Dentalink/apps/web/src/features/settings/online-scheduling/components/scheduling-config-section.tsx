import { Eye, Plus, Settings, Upload } from "lucide-react";
import { useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EntitySearchBox } from "@/components/ui/entity-search-box";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils/cn";
import { useBranches } from "@/features/settings/branches/hooks/use-branches";
import { useProfessionals } from "@/features/settings/professionals/hooks/use-professionals";
import { useSpecialties } from "@/features/settings/specialties/hooks/use-specialties";
import type { Branch } from "@/features/settings/branches/services/branches.service";
import { OnlineSchedulingDrawer } from "./online-scheduling-drawer";
import { APP_ROUTES } from "@/lib/routes";
import {
  brandColors,
  patientFieldDefinitions,
  type FieldState,
  type SchedulingMode,
  type SchedulingSettings
} from "./scheduling-settings-model";
import { useStoredSettings } from "./use-stored-scheduling-settings";

export { backendToFrontendSettings, frontendToBackendDto } from "./scheduling-settings-model";
export { useStoredSettings } from "./use-stored-scheduling-settings";

type ConfigTab = "appointments" | "administrative" | "professionals" | "services";
type DrawerName = "special" | "branches" | "patient-fields" | "analytics" | "redirect" | "branding" | null;

export function SchedulingConfigSection({ mode }: { mode: SchedulingMode }) {
  const [activeTab, setActiveTab] = useState<ConfigTab>("appointments");
  const [drawer, setDrawer] = useState<DrawerName>(null);
  const [branchSearch, setBranchSearch] = useState("");
  const [settings, setSettings] = useStoredSettings(mode);
  const branches = useBranches(undefined, "ACTIVE");

  const filteredBranches = useMemo(
    () =>
      (branches.data ?? []).filter((branch) =>
        branch.name.toLowerCase().includes(branchSearch.trim().toLowerCase())
      ),
    [branchSearch, branches.data]
  );

  const update = <K extends keyof SchedulingSettings>(key: K, value: SchedulingSettings[K]) => {
    setSettings((current) => ({ ...current, [key]: value }));
  };

  const toggleBranch = (branch: Branch) => {
    setSettings((current) => {
      const currentAllowed = { ...current.allowedBranches };
      if (Object.keys(currentAllowed).length === 0 && branches.data) {
        branches.data.forEach((b) => {
          currentAllowed[b.id] = true;
        });
      }
      currentAllowed[branch.id] = !(currentAllowed[branch.id] ?? true);
      return {
        ...current,
        allowedBranches: currentAllowed
      };
    });
  };

  const togglePatientField = (fieldId: string, key: keyof FieldState) => {
    setSettings((current) => {
      const field = current.patientFields[fieldId] ?? { present: false, required: false };
      const nextField =
        key === "required" && !field.required
          ? { present: true, required: true }
          : key === "present" && field.present
            ? { present: false, required: false }
            : { ...field, [key]: !field[key] };

      return {
        ...current,
        patientFields: {
          ...current.patientFields,
          [fieldId]: nextField
        }
      };
    });
  };

  const tabs = [
    { id: "appointments" as const, label: "Configuracion de Citas" },
    { id: "administrative" as const, label: "Configuraciones Administrativas" },
    { id: "professionals" as const, label: "Configuracion de Profesionales" },
    { id: "services" as const, label: "Configuracion de Servicios" }
  ];

  return (
    <div>
      <div className="flex flex-wrap gap-x-7 border-b border-slate-200 text-sm">
        {tabs.map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => setActiveTab(tab.id)}
            className={cn(
              "border-b-2 pb-3 font-medium transition-colors",
              activeTab === tab.id
                ? "border-[var(--border-brand)] text-[var(--text-brand)]"
                : "border-transparent text-[var(--text-secondary)] hover:text-[var(--text-primary)]"
            )}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {activeTab === "appointments" ? (
        <AppointmentSettings mode={mode} settings={settings} update={update} onSpecial={() => setDrawer("special")} />
      ) : null}

      {activeTab === "administrative" ? (
        <AdministrativeSettings onDrawer={setDrawer} settings={settings} update={update} />
      ) : null}

      {activeTab === "professionals" ? (
        <ProfessionalListSettings settings={settings} update={update} />
      ) : null}

      {activeTab === "services" ? (
        <ServiceListSettings settings={settings} update={update} />
      ) : null}

      <OnlineSchedulingDrawer
        open={drawer === "special"}
        onClose={() => setDrawer(null)}
        title="Configuracion de mi agenda online"
        footer={
          <>
            <Button type="button" variant="secondary" onClick={() => setDrawer(null)}>
              Cancelar
            </Button>
            <Button type="button" onClick={() => setDrawer(null)}>
              Guardar
            </Button>
          </>
        }
      >
        <SpecialSettings settings={settings} update={update} />
      </OnlineSchedulingDrawer>

      <OnlineSchedulingDrawer
        open={drawer === "branches"}
        onClose={() => setDrawer(null)}
        title="Habilitar o deshabilitar sucursales"
      >
        <div className="space-y-4 p-5">
          <label className="block">
            <EntitySearchBox
              value={branchSearch}
              onValueChange={setBranchSearch}
              items={branchSearch.trim() ? filteredBranches : []}
              onSelect={(branch) => {
                setBranchSearch(branch.name);
                toggleBranch(branch);
              }}
              getItemKey={(branch) => branch.id}
              placeholder="Buscar sucursal"
              emptyMessage="Sin sucursales encontradas"
              renderItem={(branch) => (
                <div className="min-w-0">
                  <p className="truncate text-sm font-semibold text-slate-900">{branch.name}</p>
                  <p className="mt-0.5 truncate text-xs text-slate-500">
                    {settings.allowedBranches[branch.id] ?? true ? "Habilitada" : "Deshabilitada"}
                  </p>
                </div>
              )}
            />
          </label>
          <div className="divide-y divide-slate-200">
            {filteredBranches.map((branch) => (
              <ToggleRow
                key={branch.id}
                label={branch.name}
                checked={settings.allowedBranches[branch.id] ?? true}
                onChange={() => toggleBranch(branch)}
              />
            ))}
            {!filteredBranches.length ? <p className="py-4 text-sm text-slate-500">No hay sucursales para mostrar.</p> : null}
          </div>
        </div>
      </OnlineSchedulingDrawer>

      <OnlineSchedulingDrawer
        open={drawer === "patient-fields"}
        onClose={() => setDrawer(null)}
        title="Datos requeridos pacientes nuevos en Agenda Online"
      >
        <PatientFieldsTable settings={settings} onToggle={togglePatientField} />
      </OnlineSchedulingDrawer>

      <OnlineSchedulingDrawer
        open={drawer === "analytics"}
        onClose={() => setDrawer(null)}
        title="Google Analytics y Facebook Pixel"
      >
        <div className="space-y-5 p-5">
          <label className="grid gap-1 text-sm font-semibold text-slate-900">
            Google Analytics
            <Input
              value={settings.analyticsCode}
              onChange={(event) => update("analyticsCode", event.target.value)}
              placeholder="UA-XXXXXXXXX-X o G-XXXXXXXXXX"
            />
          </label>
          <InfoBox>
            Ahora soportamos Google Analytics 4, por lo que puedes agregar tu codigo actualizado. Si aun no lo tienes,
            seguimos soportando el de Universal Analytics.
          </InfoBox>
          <label className="grid gap-1 text-sm font-semibold text-slate-900">
            Facebook Pixel
            <Input value={settings.facebookPixel} onChange={(event) => update("facebookPixel", event.target.value)} />
          </label>
        </div>
      </OnlineSchedulingDrawer>

      <OnlineSchedulingDrawer
        open={drawer === "redirect"}
        onClose={() => setDrawer(null)}
        title="Pagina web de redireccionamiento"
      >
        <div className="space-y-3 p-5">
          <p className="text-sm text-slate-600">
            Define a que URL se enviara al paciente cuando termine de confirmar su cita online.
          </p>
          <Input
            value={settings.redirectUrl}
            onChange={(event) => update("redirectUrl", event.target.value)}
            placeholder="https://tu-clinica.mx/gracias"
          />
        </div>
      </OnlineSchedulingDrawer>

      <OnlineSchedulingDrawer
        open={drawer === "branding"}
        onClose={() => setDrawer(null)}
        title="Logotipo, color y pie de pagina"
      >
        <BrandingSettings settings={settings} update={update} />
      </OnlineSchedulingDrawer>
    </div>
  );
}

function AppointmentSettings({
  mode,
  onSpecial,
  settings,
  update
}: {
  mode: SchedulingMode;
  onSpecial: () => void;
  settings: SchedulingSettings;
  update: <K extends keyof SchedulingSettings>(key: K, value: SchedulingSettings[K]) => void;
}) {
  return (
    <div>
      {mode === "online" ? (
        <SettingsSection
          title="Configuracion especial de mi agenda online"
          description="Aqui podras definir como sera tu agenda online, personalizar opciones como profesional, especialidad, sucursal, identificacion del paciente y duracion de cita."
          action={<SettingsButton onClick={onSpecial} title="Configurar agenda online" />}
        />
      ) : null}

      <ChoiceSection
        title="Cantidad de bloques que se ocuparan en cada cita"
        selected={settings.appointmentBlocks}
        options={["1", "2", "3", "4", "5"].map((value) => ({
          value,
          label: `${value} bloque${value === "1" ? "" : "s"}`
        }))}
        onChange={(value) => update("appointmentBlocks", value)}
      >
        Esto corresponde a la duracion estandar de una cita agendada online. La cantidad de bloques se refiere a los
        intervalos de atencion usados.
      </ChoiceSection>

      {mode === "online" ? (
        <ChoiceSection
          title="Maximo de dias para mostrar disponibilidad en listado de profesionales"
          selected={settings.maxAvailabilityDays}
          options={["30", "45", "60", "90"].map((value) => ({ value, label: `${value} dias` }))}
          onChange={(value) => update("maxAvailabilityDays", value)}
        >
          Al consultar disponibilidad de multiples profesionales, se mostraran citas segun el maximo de dias configurado.
        </ChoiceSection>
      ) : null}

      <ChoiceSection
        title="Tiempo de seguridad para mostrar citas disponibles"
        selected={settings.safetyHours}
        options={["0", "1", "2", "4", "8", "12", "16", "20", "24", "48"].map((value) => ({
          value,
          label: `${value} hora${value === "1" ? "" : "s"}`
        }))}
        onChange={(value) => update("safetyHours", value)}
      >
        Cuando una persona consulta disponibilidad, se mostraran horas disponibles a partir del margen de seguridad
        elegido.
      </ChoiceSection>

      <ChoiceSection
        title="Cantidad maxima de citas no validadas por paciente"
        selected={settings.maxUnvalidatedAppointments}
        options={["1", "2", "3", "4", "5", "6", "7", "8"].map((value) => ({
          value,
          label: `${value} cita${value === "1" ? "" : "s"}`
        }))}
        onChange={(value) => update("maxUnvalidatedAppointments", value)}
        last
      >
        Limite de citas futuras que un mismo paciente puede tener reservadas de forma simultanea.
      </ChoiceSection>
    </div>
  );
}

function AdministrativeSettings({
  onDrawer,
  settings,
  update
}: {
  onDrawer: (drawer: DrawerName) => void;
  settings: SchedulingSettings;
  update: <K extends keyof SchedulingSettings>(key: K, value: SchedulingSettings[K]) => void;
}) {
  return (
    <div className="space-y-6">
      <div className="p-6 bg-white border border-slate-200 rounded-lg mt-6">
        <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4 mb-4">Mensaje confirmación de reserva</h2>
        <p className="text-xs text-slate-500 mb-4">
          Este mensaje aparecerá en el portal de pacientes luego de agendar exitosamente la cita.
        </p>
        <textarea
          className="w-full max-w-3xl border border-slate-300 rounded-md p-3 text-sm focus:outline-none focus:border-sky-500 text-slate-800"
          rows={4}
          value={settings.confirmationMessage || ""}
          onChange={(e) => update("confirmationMessage", e.target.value)}
        />
      </div>

      <SettingsSection
        title="Agendamiento online"
        description="Habilita o deshabilita el formulario de agendamiento. Si lo deshabilitas puedes mostrar un mensaje personalizado."
        action={<ToggleLabel checked={settings.onlineEnabled} onChange={() => update("onlineEnabled", !settings.onlineEnabled)} />}
      />
      <SettingsSection
        title="Pacientes con bloqueo para agenda online y express"
        description="Permite bloquear pacientes para que no creen citas por medio del agendamiento online o express."
        action={
          <ToggleLabel
            checked={settings.patientBlockEnabled}
            onChange={() => update("patientBlockEnabled", !settings.patientBlockEnabled)}
          />
        }
      />
      <ChoiceSection
        title="Sillones disponibles"
        selected={settings.chairScope}
        options={[
          { value: "all", label: "Todos" },
          { value: "single", label: "Solo Sillon 1" }
        ]}
        onChange={(value) => update("chairScope", value as SchedulingSettings["chairScope"])}
      >
        Configura si se puede agendar en todos los sillones de los profesionales o solo en el sillon principal.
      </ChoiceSection>
      <SettingsSection
        title="Sucursales permitidas"
        description="Selecciona que sucursal sera visible desde la agenda online. Al inicio estan disponibles todas."
        action={<SettingsButton onClick={() => onDrawer("branches")} title="Configurar sucursales" />}
      />
      <SettingsSection
        title="Datos requeridos pacientes nuevos"
        description="Decide que datos son obligatorios al crear un paciente nuevo desde agenda online."
        action={<SettingsButton onClick={() => onDrawer("patient-fields")} title="Configurar datos requeridos" />}
      />
      <SettingsSection
        title="Google Analytics y Facebook Pixel"
        description="Configura trackers para medir cuanta gente llega y cuanta gente reserva una cita."
        action={<SettingsButton onClick={() => onDrawer("analytics")} title="Configurar trackers" />}
      />
      <SettingsSection
        title="Pagina web de redireccionamiento al finalizar agendamiento"
        description="Elige la pagina web a la que se redirige al paciente luego de confirmar su cita."
        action={<SettingsButton onClick={() => onDrawer("redirect")} title="Configurar redireccion" />}
      />
      <SettingsSection
        title="Logotipo, color y pie de pagina"
        description="Personaliza el logotipo, color y pie de pagina de tu agenda online."
        action={<SettingsButton onClick={() => onDrawer("branding")} title="Configurar marca" />}
        last
      />
    </div>
  );
}

function ProfessionalSettings({ mode }: { mode: SchedulingMode }) {
  return (
    <div className="border-b border-slate-100 px-1 py-8">
      <h3 className="text-base font-semibold text-slate-900">Configuracion de profesionales</h3>
      <p className="mt-2 max-w-2xl text-sm text-slate-600">
        La disponibilidad de {mode === "express" ? "Agenda Express" : "Agenda Online"} usa horarios activos por
        profesional y sucursal. Ajusta esos horarios antes de publicar el link de agendamiento.
      </p>
      <Link
        to={APP_ROUTES.settings.schedules}
        className="mt-4 inline-flex h-[38px] items-center justify-center rounded-[var(--radius-md)] bg-[var(--action-brand)] px-[var(--space-4)] text-[var(--text-base)] font-medium text-[var(--text-inverse)] hover:bg-[var(--action-brand-hover)] transition-colors"
      >
        Gestionar horarios
      </Link>
    </div>
  );
}

function SpecialSettings({
  settings,
  update
}: {
  settings: SchedulingSettings;
  update: <K extends keyof SchedulingSettings>(key: K, value: SchedulingSettings[K]) => void;
}) {
  return (
    <div className="divide-y divide-slate-200">
      <DrawerIntro>
        <p>Selecciona y personaliza la agenda online de tu clinica segun tus preferencias y necesidades:</p>
      </DrawerIntro>
      <DrawerBlock title="Menu de agendamiento">
        <InfoBox>
          Define si quieres un menu de opciones al inicio del agendamiento. Se debe activar al menos una opcion.
        </InfoBox>
        <ToggleRow
          label="Agendar por profesional"
          checked={settings.menuByProfessional}
          onChange={() => update("menuByProfessional", !settings.menuByProfessional)}
        />
        <ToggleRow
          label="Agendar por especialidad"
          checked={settings.menuBySpecialty}
          onChange={() => update("menuBySpecialty", !settings.menuBySpecialty)}
        />
        <ToggleRow
          label="Agendar por sucursal"
          detail="En caso de tener mas de una"
          checked={settings.menuByBranch}
          onChange={() => update("menuByBranch", !settings.menuByBranch)}
        />
      </DrawerBlock>
      <DrawerBlock title="Identificacion del paciente">
        <InfoBox>Aqui defines como quieres que el paciente se identifique al agendar.</InfoBox>
        <ToggleRow
          label="Identificacion con CURP/RFC"
          checked={settings.identifyByCurp}
          onChange={() => update("identifyByCurp", !settings.identifyByCurp)}
        />
        <ToggleRow
          label="Identificacion con email"
          checked={settings.identifyByEmail}
          onChange={() => update("identifyByEmail", !settings.identifyByEmail)}
        />
        <ToggleRow
          label="Identificacion con telefono movil"
          checked={settings.identifyByMobile}
          onChange={() => update("identifyByMobile", !settings.identifyByMobile)}
        />
      </DrawerBlock>
      <DrawerBlock title="Datos personales del paciente">
        <InfoBox>Selecciona cuando pedir los datos personales del paciente, al inicio o al final.</InfoBox>
        <div className="mt-2 flex gap-2">
          <SegmentButton
            active={settings.patientDataMoment === "start"}
            label="Pedir al inicio"
            onClick={() => update("patientDataMoment", "start")}
          />
          <SegmentButton
            active={settings.patientDataMoment === "end"}
            label="Pedir al final"
            onClick={() => update("patientDataMoment", "end")}
          />
        </div>
      </DrawerBlock>
      <DrawerBlock title="Motivo de atencion segun especialidad">
        <ToggleRow
          label="Preguntar el motivo de atencion para las especialidades que lo tengan configurado."
          detail="Al activar los servicios, se ocultaran los motivos de atencion en la Agenda Online."
          checked={settings.askSpecialtyReason}
          onChange={() => update("askSpecialtyReason", !settings.askSpecialtyReason)}
        />
      </DrawerBlock>
      <DrawerBlock title="Mostrar duracion de cita">
        <ToggleRow
          label="Selecciona si quieres mostrarle al paciente cuanto dura el bloque agendado."
          checked={settings.showAppointmentDuration}
          onChange={() => update("showAppointmentDuration", !settings.showAppointmentDuration)}
        />
      </DrawerBlock>
    </div>
  );
}

function PatientFieldsTable({
  onToggle,
  settings
}: {
  onToggle: (fieldId: string, key: keyof FieldState) => void;
  settings: SchedulingSettings;
}) {
  return (
    <div className="p-5">
      <div className="overflow-hidden rounded border border-slate-200">
        <table className="w-full border-collapse text-sm text-slate-700">
          <thead className="bg-slate-50 font-semibold text-slate-900">
            <tr>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-left">Dato</th>
              <th className="border-b border-r border-slate-200 px-2 py-2 text-center">Presente</th>
              <th className="border-b border-slate-200 px-2 py-2 text-center">Requerido</th>
            </tr>
          </thead>
          <tbody>
            {patientFieldDefinitions.map((field) => {
              const state = settings.patientFields[field.id] ?? { present: false, required: false };
              return (
                <tr key={field.id}>
                  <td className="border-b border-r border-slate-200 px-2 py-1.5">
                    {field.label}
                    {field.info ? <span className="ml-1 inline-flex h-3 w-3 items-center justify-center rounded-full bg-sky-500 text-[8px] text-white">i</span> : null}
                  </td>
                  <td className="border-b border-r border-slate-200 px-2 py-1 text-center">
                    <CircleCheck checked={state.present} onClick={() => onToggle(field.id, "present")} />
                  </td>
                  <td className="border-b border-slate-200 px-2 py-1 text-center">
                    <CircleCheck checked={state.required} onClick={() => onToggle(field.id, "required")} />
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function BrandingSettings({
  settings,
  update
}: {
  settings: SchedulingSettings;
  update: <K extends keyof SchedulingSettings>(key: K, value: SchedulingSettings[K]) => void;
}) {
  return (
    <div className="space-y-8 p-6">
      <Button type="button" variant="secondary" className="border-0 bg-[var(--bg-brand-light)] text-[var(--text-brand)] shadow-none">
        Previsualizar agenda <Eye className="ml-1.5 h-4 w-4" />
      </Button>

      <section className="space-y-3">
        <h3 className="text-base font-medium text-slate-900">Logotipo</h3>
        <p className="text-sm text-slate-500">
          Personaliza el logotipo de tu agenda online. Si no hay un logotipo configurado, se usara el logotipo del centro.
        </p>
        <label className="flex min-h-40 cursor-pointer flex-col items-center justify-center rounded border border-dashed border-sky-200 px-6 text-center text-sm text-slate-500 hover:bg-sky-50/40">
          <Upload className="mb-3 h-6 w-6 text-slate-400" />
          <span>{settings.logoName || "Sube una imagen"}</span>
          <span className="mt-2 text-xs">Selecciona un archivo o arrastralo aqui. Solo formato .png.</span>
          <input
            type="file"
            accept=".png,image/png"
            className="sr-only"
            onChange={(event) => update("logoName", event.target.files?.[0]?.name ?? "")}
          />
        </label>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium text-slate-900">Color</h3>
        <p className="text-sm text-slate-500">Selecciona el color para tu agenda online.</p>
        <div className="flex flex-wrap gap-4">
          {brandColors.map((color) => (
            <HelpTooltip key={color} content={`Color ${color}`} position="top">
              <button
                type="button"
                aria-label={`Color ${color}`}
                onClick={() => update("brandColor", color)}
                className={cn(
                  "h-5 w-5 rounded-full border border-[var(--border-strong)]",
                  settings.brandColor === color && "ring-2 ring-[var(--border-brand)] ring-offset-2"
                )}
                style={{ backgroundColor: color }}
              />
            </HelpTooltip>
          ))}
          <HelpTooltip content="Otro color" position="top">
            <button
              type="button"
              aria-label="Otro color"
              className="flex h-5 w-5 items-center justify-center rounded-full bg-slate-200 text-slate-500"
            >
              <Plus className="h-3.5 w-3.5" />
            </button>
          </HelpTooltip>
        </div>
      </section>

      <section className="space-y-3">
        <h3 className="text-base font-medium text-slate-900">Pie de pagina</h3>
        <p className="text-sm text-slate-500">Datos de contacto a mostrar en el pie de pagina de la agenda online.</p>
        <Input
          value={settings.footerEmail}
          onChange={(event) => update("footerEmail", event.target.value)}
          placeholder="Email"
        />
        <div className="grid grid-cols-[72px_1fr]">
          <span className="flex items-center rounded-l border border-r-0 border-slate-300 px-3 text-sm">MX</span>
          <Input
            value={settings.footerPhone}
            onChange={(event) => update("footerPhone", event.target.value)}
            placeholder="Telefono"
            className="rounded-l-none"
          />
        </div>
      </section>
    </div>
  );
}

function ChoiceSection({
  children,
  last,
  onChange,
  options,
  selected,
  title
}: {
  children: string;
  last?: boolean;
  onChange: (value: string) => void;
  options: { label: string; value: string }[];
  selected: string;
  title: string;
}) {
  return (
    <section className={cn("border-b border-slate-100 px-1 py-7", last && "border-b-0 pb-3")}>
      <h3 className="mb-3 text-base font-semibold text-slate-900">{title}</h3>
      <div className="mb-3 flex flex-wrap gap-1.5">
        {options.map((option) => (
          <SegmentButton
            key={option.value}
            active={selected === option.value}
            label={option.label}
            onClick={() => onChange(option.value)}
          />
        ))}
      </div>
      <p className="max-w-3xl text-sm leading-6 text-slate-600">{children}</p>
    </section>
  );
}

function SettingsSection({
  action,
  description,
  last,
  title
}: {
  action: React.ReactNode;
  description: string;
  last?: boolean;
  title: string;
}) {
  return (
    <section className={cn("flex items-start justify-between gap-4 border-b border-slate-100 px-1 py-7", last && "border-b-0")}>
      <div>
        <h3 className="text-base font-semibold text-slate-900">{title}</h3>
        <p className="mt-2 max-w-3xl text-sm leading-6 text-slate-600">{description}</p>
      </div>
      <div className="shrink-0">{action}</div>
    </section>
  );
}

function SettingsButton({ onClick, title }: { onClick: () => void; title: string }) {
  return (
    <HelpTooltip content={title} position="left">
      <Button
        type="button"
        aria-label={title}
        onClick={onClick}
        className="h-8 w-12 rounded bg-[var(--action-brand)] p-0 hover:bg-[var(--action-brand-hover)] border-0"
      >
        <Settings className="h-4 w-4" />
      </Button>
    </HelpTooltip>
  );
}

function SegmentButton({ active, label, onClick }: { active: boolean; label: string; onClick: () => void }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={cn(
        "rounded px-4 py-1.5 text-sm font-medium transition-colors",
        active ? "bg-[var(--action-primary)] text-[var(--text-inverse)]" : "bg-[var(--bg-subtle)] text-[var(--text-primary)] hover:bg-[var(--border-default)]"
      )}
    >
      {label}
    </button>
  );
}

function ToggleLabel({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <div className="flex items-center gap-2 whitespace-nowrap text-base text-[var(--text-secondary)]">
      <span className={checked ? "font-medium text-[var(--text-brand)]" : ""}>{checked ? "Habilitado" : "Deshabilitado"}</span>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function ToggleRow({
  checked,
  detail,
  label,
  onChange
}: {
  checked: boolean;
  detail?: string;
  label: string;
  onChange: () => void;
}) {
  return (
    <div className="flex min-h-11 items-center justify-between gap-4 py-2">
      <div className="min-w-0">
        <p className="text-sm text-slate-800">{label}</p>
        {detail ? <p className="mt-0.5 text-xs text-slate-500">{detail}</p> : null}
      </div>
      <Toggle checked={checked} onChange={onChange} />
    </div>
  );
}

function Toggle({ checked, onChange }: { checked: boolean; onChange: () => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={onChange}
      className={cn(
        "relative h-6 w-11 shrink-0 rounded-full transition-colors",
        checked ? "bg-[var(--action-brand)]" : "bg-[var(--border-strong)]"
      )}
    >
      <span
        className={cn(
          "absolute left-0.5 top-0.5 h-5 w-5 rounded-full bg-white shadow transition-transform",
          checked ? "translate-x-5" : "translate-x-0"
        )}
      />
    </button>
  );
}

function CircleCheck({ checked, onClick }: { checked: boolean; onClick: () => void }) {
  return (
    <button
      type="button"
      aria-pressed={checked}
      onClick={onClick}
      className={cn(
        "inline-flex h-5 w-5 items-center justify-center rounded-full border text-[11px] font-bold",
        checked ? "border-emerald-200 bg-emerald-200 text-white" : "border-slate-300 bg-white text-transparent"
      )}
    >
      {checked ? "v" : "o"}
    </button>
  );
}

function DrawerIntro({ children }: { children: React.ReactNode }) {
  return <div className="p-5 text-sm leading-6 text-slate-700">{children}</div>;
}

function DrawerBlock({ children, title }: { children: React.ReactNode; title: string }) {
  return (
    <section className="p-5">
      <h3 className="mb-3 text-sm font-bold uppercase text-slate-900">{title}</h3>
      {children}
    </section>
  );
}

function InfoBox({ children }: { children: React.ReactNode }) {
  return <div className="mb-2 rounded bg-sky-100/80 p-3 text-sm leading-5 text-sky-950">{children}</div>;
}

function ProfessionalListSettings({ settings, update }: { settings: SchedulingSettings; update: (k: keyof SchedulingSettings, v: any) => void }) {
  const { data: professionals = [] } = useProfessionals();

  const toggle = (id: string) => {
    const current = settings.allowedProfessionals || [];
    const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    update("allowedProfessionals", updated);
  };

  return (
    <div className="p-6 space-y-6 bg-white border border-slate-200 rounded-lg mt-6">
      <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">Configuración de Profesionales</h2>
      <p className="text-xs text-slate-500 mb-6">
        Selecciona qué profesionales estarán disponibles para que los pacientes puedan agendar horas directamente con ellos en la plataforma online.
      </p>
      <div className="grid gap-3 max-w-3xl">
        {professionals.filter(p => p.isActive).map((p) => (
          <label key={p.id} className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer">
            <div>
              <div className="font-medium text-slate-800">{p.firstName} {p.lastName}</div>
            </div>
            <input 
              type="checkbox" 
              checked={settings.allowedProfessionals?.includes(p.id) ?? false} 
              onChange={() => toggle(p.id)}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer" 
            />
          </label>
        ))}
        {professionals.length === 0 && (
          <div className="text-sm text-slate-500 p-4 border border-slate-200 border-dashed rounded text-center">No hay profesionales registrados.</div>
        )}
      </div>
    </div>
  );
}

function ServiceListSettings({ settings, update }: { settings: SchedulingSettings; update: (k: keyof SchedulingSettings, v: any) => void }) {
  const { data: specialties = [] } = useSpecialties();

  const toggle = (id: string) => {
    const current = settings.allowedSpecialties || [];
    const updated = current.includes(id) ? current.filter(x => x !== id) : [...current, id];
    update("allowedSpecialties", updated);
  };

  return (
    <div className="p-6 space-y-6 bg-white border border-slate-200 rounded-lg mt-6">
      <h2 className="text-lg font-bold text-slate-800 border-b border-slate-100 pb-4">Configuración de Especialidades y Servicios</h2>
      <p className="text-xs text-slate-500 mb-6">
        Selecciona qué especialidades se mostrarán a los pacientes en el flujo de agendamiento cuando eligen "Por Especialidad".
      </p>
      <div className="grid gap-3 max-w-3xl">
        {specialties.map((s) => (
          <label key={s.id} className="flex items-center justify-between p-3 border border-slate-200 rounded hover:bg-slate-50 cursor-pointer">
            <div>
              <div className="font-medium text-slate-800">{s.name}</div>
            </div>
            <input 
              type="checkbox" 
              checked={settings.allowedSpecialties?.includes(s.id) ?? false} 
              onChange={() => toggle(s.id)}
              className="w-5 h-5 accent-sky-600 rounded cursor-pointer" 
            />
          </label>
        ))}
        {specialties.length === 0 && (
          <div className="text-sm text-slate-500 p-4 border border-slate-200 border-dashed rounded text-center">No hay especialidades registradas.</div>
        )}
      </div>
    </div>
  );
}
