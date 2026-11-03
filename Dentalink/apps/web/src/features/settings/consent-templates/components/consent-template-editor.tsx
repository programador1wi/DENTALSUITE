import { Node, mergeAttributes } from "@tiptap/core";
import TextAlign from "@tiptap/extension-text-align";
import { EditorContent, useEditor } from "@tiptap/react";
import StarterKit from "@tiptap/starter-kit";
import {
  AlignCenter,
  AlignJustify,
  AlignLeft,
  AlignRight,
  Bold,
  CalendarDays,
  FileDigit,
  Heading1,
  Heading2,
  Heading3,
  Italic,
  List,
  ListOrdered,
  Minus,
  Redo2,
  RotateCcw,
  Strikethrough,
  TextCursorInput,
  Undo2,
  UserRound,
  Variable
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Modal } from "@/components/ui/modal";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import type { ConsentVariableDefinition } from "@/features/documents/services/documents.service";

type TokenKind = "PREFILLED_TEXT" | "FREE_TEXT" | "DATE" | "DOCUMENT_ID" | "REPRESENTATIVE";

const ConsentToken = Node.create({
  name: "consentToken",
  group: "inline",
  inline: true,
  atom: true,
  selectable: true,
  addAttributes() {
    return {
      kind: { default: "FREE_TEXT" },
      key: { default: "" },
      label: { default: "" },
      config: { default: "{}" }
    };
  },
  parseHTML() {
    return [{ tag: "span[data-consent-token]" }];
  },
  renderHTML({ HTMLAttributes }) {
    const label = String(HTMLAttributes.label || HTMLAttributes.key || "Campo dinámico");
    return [
      "span",
      mergeAttributes(
        {
          "data-consent-token": HTMLAttributes.kind,
          "data-key": HTMLAttributes.key,
          class: "consent-editor-token",
          contenteditable: "false"
        },
        { title: `${HTMLAttributes.kind}: ${HTMLAttributes.key}` }
      ),
      label
    ];
  }
});

const TOKEN_BUTTONS: Array<{ kind: TokenKind; label: string; icon: typeof TextCursorInput }> = [
  { kind: "PREFILLED_TEXT", label: "Texto prellenado", icon: RotateCcw },
  { kind: "FREE_TEXT", label: "Texto libre", icon: TextCursorInput },
  { kind: "DATE", label: "Fecha", icon: CalendarDays },
  { kind: "DOCUMENT_ID", label: "ID documento", icon: FileDigit },
  { kind: "REPRESENTATIVE", label: "Representante", icon: UserRound }
];

const DATE_SOURCES = [
  ["CURRENT_DATE", "Fecha actual"],
  ["CREATED_AT", "Fecha de creación"],
  ["APPOINTMENT_DATE", "Fecha de la cita"],
  ["TREATMENT_DATE", "Fecha del tratamiento"],
  ["PATIENT_BIRTH_DATE", "Nacimiento del paciente"],
  ["MANUAL", "Fecha manual"],
  ["PATIENT_SIGNED_AT", "Firma del paciente"],
  ["PROFESSIONAL_SIGNED_AT", "Firma profesional"]
];

type FieldDraft = {
  key: string;
  label: string;
  helpText: string;
  placeholder: string;
  defaultValue: string;
  required: boolean;
  editable: boolean;
  showInFinal: boolean;
  multiline: boolean;
  minLength: string;
  maxLength: string;
  dateSource: string;
  dateFormat: string;
  documentSource: string;
  documentDisplay: string;
  maskInAdmin: boolean;
  representativeRule: string;
};

const EMPTY_FIELD: FieldDraft = {
  key: "",
  label: "",
  helpText: "",
  placeholder: "",
  defaultValue: "",
  required: false,
  editable: true,
  showInFinal: true,
  multiline: false,
  minLength: "",
  maxLength: "",
  dateSource: "CURRENT_DATE",
  dateFormat: "long",
  documentSource: "PATIENT",
  documentDisplay: "TYPE_AND_NUMBER",
  maskInAdmin: true,
  representativeRule: "MANUAL"
};

export function ConsentTemplateEditor({
  value,
  onChange,
  variables
}: {
  value: Record<string, unknown>;
  onChange: (value: Record<string, unknown>) => void;
  variables: ConsentVariableDefinition[];
}) {
  const [fieldKind, setFieldKind] = useState<TokenKind | null>(null);
  const [field, setField] = useState<FieldDraft>(EMPTY_FIELD);
  const [variableKey, setVariableKey] = useState("");

  const editor = useEditor({
    extensions: [
      StarterKit.configure({ heading: { levels: [1, 2, 3] } }),
      TextAlign.configure({ types: ["heading", "paragraph"], alignments: ["left", "center", "right", "justify"] }),
      ConsentToken
    ],
    content: value,
    editorProps: {
      attributes: {
        class:
          "consent-editor-content min-h-[360px] px-[var(--space-6)] py-[var(--space-5)] text-[var(--text-base)] text-[var(--text-primary)] focus:outline-none"
      }
    },
    onUpdate: ({ editor: current }) => onChange(current.getJSON() as Record<string, unknown>)
  });

  const serializedValue = useMemo(() => JSON.stringify(value), [value]);
  useEffect(() => {
    if (!editor) return;
    if (JSON.stringify(editor.getJSON()) !== serializedValue) {
      editor.commands.setContent(value, { emitUpdate: false });
    }
  }, [editor, serializedValue, value]);

  const insertField = () => {
    if (!editor || !fieldKind || !field.key.trim() || !field.label.trim()) return;
    const config = {
      helpText: field.helpText.trim(),
      placeholder: field.placeholder.trim(),
      defaultValue: field.defaultValue,
      required: field.required,
      editable: field.editable,
      showInFinal: field.showInFinal,
      multiline: field.multiline,
      minLength: field.minLength ? Number(field.minLength) : null,
      maxLength: field.maxLength ? Number(field.maxLength) : null,
      dateSource: field.dateSource,
      dateFormat: field.dateFormat,
      documentSource: field.documentSource,
      documentDisplay: field.documentDisplay,
      maskInAdmin: field.maskInAdmin,
      representativeRule: field.representativeRule
    };
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "consentToken",
          attrs: {
            kind: fieldKind,
            key: field.key.trim(),
            label: field.label.trim(),
            config: JSON.stringify(config)
          }
        },
        { type: "text", text: " " }
      ])
      .run();
    setFieldKind(null);
    setField(EMPTY_FIELD);
  };

  const insertVariable = () => {
    const definition = variables.find((entry) => entry.key === variableKey);
    if (!editor || !definition) return;
    editor
      .chain()
      .focus()
      .insertContent([
        {
          type: "consentToken",
          attrs: {
            kind: "VARIABLE",
            key: definition.key,
            label: definition.label,
            config: JSON.stringify({ sensitive: definition.sensitive, fallback: definition.fallback })
          }
        },
        { type: "text", text: " " }
      ])
      .run();
    setVariableKey("");
  };

  if (!editor) return <div className="h-[420px] animate-pulse rounded-[var(--radius-lg)] bg-[var(--bg-subtle)]" />;

  return (
    <div className="overflow-hidden rounded-[var(--radius-lg)] border border-[var(--border-default)] bg-[var(--bg-surface)] focus-within:border-[var(--border-brand)] focus-within:ring-2 focus-within:ring-[var(--focus-ring)]">
      <div className="border-b border-[var(--border-default)] bg-[var(--bg-subtle)] p-[var(--space-2)]">
        <div className="flex flex-wrap items-center gap-[var(--space-1)]" role="toolbar" aria-label="Formato del consentimiento">
          <ToolbarButton label="Deshacer" active={false} onClick={() => editor.chain().focus().undo().run()} icon={Undo2} />
          <ToolbarButton label="Rehacer" active={false} onClick={() => editor.chain().focus().redo().run()} icon={Redo2} />
          <ToolbarDivider />
          <ToolbarButton label="Negrita" active={editor.isActive("bold")} onClick={() => editor.chain().focus().toggleBold().run()} icon={Bold} />
          <ToolbarButton label="Cursiva" active={editor.isActive("italic")} onClick={() => editor.chain().focus().toggleItalic().run()} icon={Italic} />
          <ToolbarButton label="Tachado" active={editor.isActive("strike")} onClick={() => editor.chain().focus().toggleStrike().run()} icon={Strikethrough} />
          <ToolbarDivider />
          <ToolbarButton label="Encabezado 1" active={editor.isActive("heading", { level: 1 })} onClick={() => editor.chain().focus().toggleHeading({ level: 1 }).run()} icon={Heading1} />
          <ToolbarButton label="Encabezado 2" active={editor.isActive("heading", { level: 2 })} onClick={() => editor.chain().focus().toggleHeading({ level: 2 }).run()} icon={Heading2} />
          <ToolbarButton label="Encabezado 3" active={editor.isActive("heading", { level: 3 })} onClick={() => editor.chain().focus().toggleHeading({ level: 3 }).run()} icon={Heading3} />
          <ToolbarDivider />
          <ToolbarButton label="Lista con viñetas" active={editor.isActive("bulletList")} onClick={() => editor.chain().focus().toggleBulletList().run()} icon={List} />
          <ToolbarButton label="Lista numerada" active={editor.isActive("orderedList")} onClick={() => editor.chain().focus().toggleOrderedList().run()} icon={ListOrdered} />
          <ToolbarButton label="Separador" active={false} onClick={() => editor.chain().focus().setHorizontalRule().run()} icon={Minus} />
          <ToolbarDivider />
          <ToolbarButton label="Alinear a la izquierda" active={editor.isActive({ textAlign: "left" })} onClick={() => editor.chain().focus().setTextAlign("left").run()} icon={AlignLeft} />
          <ToolbarButton label="Centrar" active={editor.isActive({ textAlign: "center" })} onClick={() => editor.chain().focus().setTextAlign("center").run()} icon={AlignCenter} />
          <ToolbarButton label="Alinear a la derecha" active={editor.isActive({ textAlign: "right" })} onClick={() => editor.chain().focus().setTextAlign("right").run()} icon={AlignRight} />
          <ToolbarButton label="Justificar" active={editor.isActive({ textAlign: "justify" })} onClick={() => editor.chain().focus().setTextAlign("justify").run()} icon={AlignJustify} />
        </div>
      </div>

      <div className="border-b border-[var(--border-default)] px-[var(--space-3)] py-[var(--space-2)]">
        <p className="mb-[var(--space-2)] text-[var(--text-xs)] font-medium uppercase tracking-wide text-[var(--text-secondary)]">
          Componentes dinámicos
        </p>
        <div className="flex flex-wrap gap-[var(--space-2)]">
          {TOKEN_BUTTONS.map((item) => (
            <Button
              key={item.kind}
              type="button"
              size="sm"
              variant="secondary"
              onClick={() => {
                setField({ ...EMPTY_FIELD, key: uniqueKey(item.kind), label: item.label });
                setFieldKind(item.kind);
              }}
            >
              <item.icon className="h-4 w-4" />
              {item.label}
            </Button>
          ))}
          <div className="flex min-w-[280px] flex-1 gap-[var(--space-2)]">
            <Select value={variableKey} onChange={(event) => setVariableKey(event.target.value)} aria-label="Variable dinámica">
              <option value="">Variable autorizada…</option>
              {variables.map((variable) => (
                <option key={variable.key} value={variable.key}>
                  {variable.category} · {variable.label}
                </option>
              ))}
            </Select>
            <Button type="button" size="sm" variant="secondary" disabled={!variableKey} onClick={insertVariable}>
              <Variable className="h-4 w-4" />
              Insertar
            </Button>
          </div>
        </div>
      </div>

      <EditorContent editor={editor} aria-label="Contenido de la plantilla de consentimiento" />

      <Modal
        open={Boolean(fieldKind)}
        title={`Configurar ${TOKEN_BUTTONS.find((item) => item.kind === fieldKind)?.label ?? "campo"}`}
        size="lg"
        onClose={() => setFieldKind(null)}
      >
        <div className="grid gap-[var(--space-4)] md:grid-cols-2">
          <Field label="Clave interna" hint="Única dentro de esta versión.">
            <Input aria-label="Clave interna" value={field.key} onChange={(event) => setField((current) => ({ ...current, key: slugKey(event.target.value) }))} maxLength={80} />
          </Field>
          <Field label="Etiqueta visible">
            <Input aria-label="Etiqueta visible" value={field.label} onChange={(event) => setField((current) => ({ ...current, label: event.target.value }))} maxLength={150} />
          </Field>

          {fieldKind === "PREFILLED_TEXT" ? (
            <Field label="Contenido inicial" className="md:col-span-2">
              <Textarea rows={4} value={field.defaultValue} onChange={(event) => setField((current) => ({ ...current, defaultValue: event.target.value }))} />
            </Field>
          ) : null}

          {fieldKind === "FREE_TEXT" ? (
            <>
              <Field label="Placeholder">
                <Input value={field.placeholder} onChange={(event) => setField((current) => ({ ...current, placeholder: event.target.value }))} />
              </Field>
              <Field label="Valor predeterminado">
                <Input value={field.defaultValue} onChange={(event) => setField((current) => ({ ...current, defaultValue: event.target.value }))} />
              </Field>
              <Field label="Longitud mínima">
                <Input type="number" min={0} value={field.minLength} onChange={(event) => setField((current) => ({ ...current, minLength: event.target.value }))} />
              </Field>
              <Field label="Longitud máxima">
                <Input type="number" min={1} max={5000} value={field.maxLength} onChange={(event) => setField((current) => ({ ...current, maxLength: event.target.value }))} />
              </Field>
            </>
          ) : null}

          {fieldKind === "DATE" ? (
            <>
              <Field label="Origen de fecha">
                <Select value={field.dateSource} onChange={(event) => setField((current) => ({ ...current, dateSource: event.target.value }))}>
                  {DATE_SOURCES.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
                </Select>
              </Field>
              <Field label="Formato visible">
                <Select value={field.dateFormat} onChange={(event) => setField((current) => ({ ...current, dateFormat: event.target.value }))}>
                  <option value="long">27 de julio de 2026</option>
                  <option value="short">27/07/2026</option>
                  <option value="iso">2026-07-27</option>
                </Select>
              </Field>
            </>
          ) : null}

          {fieldKind === "DOCUMENT_ID" ? (
            <>
              <Field label="Origen">
                <Select value={field.documentSource} onChange={(event) => setField((current) => ({ ...current, documentSource: event.target.value }))}>
                  <option value="PATIENT">Paciente</option>
                  <option value="REPRESENTATIVE">Representante</option>
                </Select>
              </Field>
              <Field label="Presentación">
                <Select value={field.documentDisplay} onChange={(event) => setField((current) => ({ ...current, documentDisplay: event.target.value }))}>
                  <option value="NUMBER_ONLY">Solo número</option>
                  <option value="TYPE_AND_NUMBER">Tipo y número</option>
                </Select>
              </Field>
            </>
          ) : null}

          {fieldKind === "REPRESENTATIVE" ? (
            <Field label="Regla de activación">
              <Select value={field.representativeRule} onChange={(event) => setField((current) => ({ ...current, representativeRule: event.target.value }))}>
                <option value="MANUAL">Manual</option>
                <option value="MINOR_PATIENT">Paciente menor</option>
                <option value="REGISTERED_REPRESENTATIVE">Representante registrado</option>
                <option value="ALWAYS_REQUIRED">Siempre requerido</option>
              </Select>
            </Field>
          ) : null}

          <Field label="Texto de ayuda" className="md:col-span-2">
            <Input value={field.helpText} onChange={(event) => setField((current) => ({ ...current, helpText: event.target.value }))} maxLength={250} />
          </Field>

          <div className="flex flex-wrap gap-x-[var(--space-5)] gap-y-[var(--space-3)] md:col-span-2">
            <Check label="Obligatorio" checked={field.required} onChange={(checked) => setField((current) => ({ ...current, required: checked }))} />
            <Check label="Permitir edición" checked={field.editable} onChange={(checked) => setField((current) => ({ ...current, editable: checked }))} />
            <Check label="Mostrar en documento final" checked={field.showInFinal} onChange={(checked) => setField((current) => ({ ...current, showInFinal: checked }))} />
            {fieldKind === "FREE_TEXT" ? <Check label="Varias líneas" checked={field.multiline} onChange={(checked) => setField((current) => ({ ...current, multiline: checked }))} /> : null}
            {fieldKind === "DOCUMENT_ID" ? <Check label="Ocultar parcialmente en administración" checked={field.maskInAdmin} onChange={(checked) => setField((current) => ({ ...current, maskInAdmin: checked }))} /> : null}
          </div>
        </div>
        <div className="mt-[var(--space-6)] flex justify-end gap-[var(--space-2)]">
          <Button type="button" variant="ghost" onClick={() => setFieldKind(null)}>Cancelar</Button>
          <Button type="button" disabled={!field.key.trim() || !field.label.trim()} onClick={insertField}>Insertar campo</Button>
        </div>
      </Modal>
    </div>
  );
}

function ToolbarButton({ label, active, onClick, icon: Icon }: { label: string; active: boolean; onClick: () => void; icon: typeof Bold }) {
  return (
    <button
      type="button"
      aria-label={label}
      aria-pressed={active}
      title={label}
      onClick={onClick}
      className={`flex h-8 w-8 items-center justify-center rounded-[var(--radius-md)] text-[var(--text-secondary)] transition-colors hover:bg-[var(--bg-surface)] hover:text-[var(--text-primary)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-[var(--focus-ring)] ${active ? "bg-[var(--bg-brand-light)] text-[var(--text-brand)]" : ""}`}
    >
      <Icon className="h-4 w-4" />
    </button>
  );
}

function ToolbarDivider() {
  return <span aria-hidden className="mx-[var(--space-1)] h-5 w-px bg-[var(--border-strong)]" />;
}

function Field({ label, hint, className = "", children }: { label: string; hint?: string; className?: string; children: React.ReactNode }) {
  return (
    <label className={`space-y-[var(--space-1)] ${className}`}>
      <span className="block text-[var(--text-sm)] font-medium text-[var(--text-primary)]">{label}</span>
      {children}
      {hint ? <span className="block text-[var(--text-xs)] text-[var(--text-secondary)]">{hint}</span> : null}
    </label>
  );
}

function Check({ label, checked, onChange }: { label: string; checked: boolean; onChange: (checked: boolean) => void }) {
  return (
    <label className="inline-flex items-center gap-[var(--space-2)] text-[var(--text-sm)] text-[var(--text-primary)]">
      <input type="checkbox" checked={checked} onChange={(event) => onChange(event.target.checked)} className="h-4 w-4 accent-[var(--action-brand)]" />
      {label}
    </label>
  );
}

function uniqueKey(kind: string) {
  return `${kind.toLowerCase()}_${Math.random().toString(36).slice(2, 8)}`;
}

function slugKey(value: string) {
  return value
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9_]+/g, "_")
    .replace(/^_+|_+$/g, "")
    .slice(0, 80);
}
