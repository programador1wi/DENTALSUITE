export const DIAGNOSIS_SECTIONS = [
  {
    title: "Preexistencias",
    options: [
      { label: "Corona", mark: "crown" },
      { label: "Corona provisoria", mark: "temporary-crown" },
      { label: "Endodoncia", mark: "endo" },
      { label: "Restauracion", mark: "restoration" },
      { label: "Implante", mark: "implant" },
      { label: "Perno munon", mark: "post" },
      { label: "Otro", mark: "other" },
      { label: "Protesis removible", mark: "removable" },
      { label: "Corona (mal estado)", mark: "bad-crown" },
      { label: "Corona provisoria (mal estado)", mark: "bad-temporary-crown" },
      { label: "Perno munon (mal estado)", mark: "bad-post" },
      { label: "Restauracion (mal estado)", mark: "bad-restoration" },
      { label: "Amalgama", mark: "amalgam" },
      { label: "Amalgama (mal estado)", mark: "bad-amalgam" },
      { label: "Sellante", mark: "sealant" },
      { label: "Implante (mal estado)", mark: "bad-implant" },
      { label: "Endodoncia (mal estado)", mark: "bad-endo" },
      { label: "Ausente", mark: "absent" }
    ]
  },
  {
    title: "Lesiones",
    options: [
      { label: "Caries", mark: "caries" },
      { label: "Infeccion Pulpar", mark: "pulp-infection" },
      { label: "Fractura", mark: "fracture" },
      { label: "Movilidad", mark: "mobility" },
      { label: "Residuo Radicular", mark: "root-residue" },
      { label: "Erosion", mark: "erosion" },
      { label: "Atricion", mark: "attrition" },
      { label: "Abfraccion", mark: "abfraction" },
      { label: "Otro", mark: "lesion-other" }
    ]
  },
  {
    title: "Otras simbologias",
    options: [
      { label: "Sin erupcionar", mark: "unerupted" },
      { label: "Diente sano", mark: "healthy" }
    ]
  }
] as const;

export type DiagnosisOption = (typeof DIAGNOSIS_SECTIONS)[number]["options"][number];
export type DiagnosisMark = DiagnosisOption["mark"];

const DIAGNOSIS_MARK_BY_LABEL = new Map<string, DiagnosisMark>();

for (const section of DIAGNOSIS_SECTIONS) {
  for (const option of section.options) {
    DIAGNOSIS_MARK_BY_LABEL.set(option.label.toUpperCase(), option.mark);
  }
}

export function getDiagnosisMark(value?: string | null) {
  if (!value) return undefined;
  return DIAGNOSIS_MARK_BY_LABEL.get(value.trim().toUpperCase());
}

export function ToothDiagnosisSymbol({ mark, className = "h-20 w-20" }: { mark: DiagnosisMark; className?: string }) {
  return (
    <svg className={className} viewBox="0 0 80 92" aria-hidden="true">
      <path
        d="M32 7 C24 9 22 25 25 38 C15 47 20 76 31 82 C34 70 37 54 40 45 C43 54 46 70 49 82 C60 76 65 47 55 38 C58 25 56 9 48 7 C44 6 42 11 40 19 C38 11 36 6 32 7 Z"
        fill="#f7f7f7"
        stroke="#c9cdd3"
        strokeWidth="1.4"
      />
      <path d="M35 10 C36 21 35 29 32 37" fill="none" stroke="#d7dbe0" strokeWidth="1" />
      <path d="M45 10 C44 21 45 29 48 37" fill="none" stroke="#d7dbe0" strokeWidth="1" />
      {mark === "crown" || mark === "temporary-crown" ? (
        <g>
          <circle cx="40" cy="57" r="18" fill="#cfe4ff" stroke="#2382d9" strokeWidth="2.4" />
          {mark === "temporary-crown" ? <text x="40" y="64" textAnchor="middle" fontSize="18" fontWeight="700" fill="#2382d9">P</text> : null}
        </g>
      ) : null}
      {mark === "endo" || mark === "bad-endo" ? <path d="M42 23 C41 36 41 51 38 63" fill="none" stroke={mark === "bad-endo" ? "#111" : "#2382d9"} strokeWidth="7" strokeLinecap="round" /> : null}
      {mark === "restoration" || mark === "bad-restoration" ? <circle cx="39" cy="56" r="8" fill="#2382d9" /> : null}
      {mark === "implant" || mark === "bad-implant" ? <path d="M40 25 L48 70 L32 70 Z" fill="#2382d9" /> : null}
      {mark === "post" || mark === "bad-post" ? (
        <path d="M40 39 L40 70 M35 52 L45 52 M37 59 L43 59" fill="none" stroke="#2382d9" strokeWidth="4" strokeLinecap="round" />
      ) : null}
      {mark === "other" || mark === "lesion-other" || mark === "unerupted" || mark === "healthy" ? (
        <text x="40" y="75" textAnchor="middle" fontSize="15" fontWeight="700" fill={mark === "other" ? "#2382d9" : "#111"}>*</text>
      ) : null}
      {mark === "removable" ? (
        <g stroke="#2382d9" strokeWidth="3" strokeLinecap="round">
          <line x1="30" y1="71" x2="50" y2="71" />
          <line x1="30" y1="77" x2="50" y2="77" />
        </g>
      ) : null}
      {mark === "bad-crown" || mark === "bad-temporary-crown" ? (
        <g>
          <circle cx="40" cy="57" r="18" fill="#cfe4ff" stroke="#2382d9" strokeWidth="2.4" />
          <g clipPath="url(#diagnosis-bad-circle)" stroke="#2382d9" strokeWidth="2">
            {[-4, 4, 12, 20, 28, 36, 44, 52, 60, 68, 76].map((x) => (
              <line key={x} x1={x} y1="35" x2={x - 35} y2="79" />
            ))}
          </g>
        </g>
      ) : null}
      {mark === "bad-post" ? <path d="M35 46 L45 69 M45 46 L35 69" stroke="#2382d9" strokeWidth="3" strokeLinecap="round" /> : null}
      {mark === "amalgam" || mark === "bad-amalgam" ? (
        <g>
          <path d="M32 53 C36 45 45 47 48 53 C45 61 36 61 32 53 Z" fill="#2382d9" />
          {mark === "bad-amalgam" ? <path d="M32 61 L49 45" stroke="#f7f7f7" strokeWidth="2.5" /> : null}
        </g>
      ) : null}
      {mark === "sealant" ? <path d="M30 65 C35 60 45 60 50 65" fill="none" stroke="#2382d9" strokeWidth="4" strokeLinecap="round" /> : null}
      {mark === "absent" ? (
        <g stroke="#d2182a" strokeWidth="4" strokeLinecap="round">
          <line x1="26" y1="30" x2="54" y2="70" />
          <line x1="54" y1="30" x2="26" y2="70" />
        </g>
      ) : null}
      {mark === "caries" ? <circle cx="40" cy="57" r="8" fill="#111" /> : null}
      {mark === "pulp-infection" ? <path d="M40 26 C39 39 39 55 37 68" fill="none" stroke="#111" strokeWidth="6" strokeLinecap="round" /> : null}
      {mark === "fracture" ? <path d="M47 18 L35 45 L47 43 L33 77" fill="none" stroke="#111" strokeWidth="3.5" strokeLinejoin="round" /> : null}
      {mark === "mobility" ? (
        <g stroke="#111" strokeWidth="2" strokeLinecap="round">
          <path d="M24 38 C18 48 18 58 24 68" fill="none" />
          <path d="M56 38 C62 48 62 58 56 68" fill="none" />
        </g>
      ) : null}
      {mark === "root-residue" ? <rect x="32" y="50" width="16" height="14" rx="2" fill="#111" /> : null}
      {mark === "erosion" ? <path d="M32 59 L49 59" stroke="#111" strokeWidth="5" strokeLinecap="round" /> : null}
      {mark === "attrition" ? <path d="M28 68 C34 76 46 76 52 68" fill="none" stroke="#111" strokeWidth="4" strokeLinecap="round" /> : null}
      {mark === "abfraction" ? <path d="M29 52 L51 52" stroke="#111" strokeWidth="4" strokeLinecap="round" /> : null}
      <defs>
        <clipPath id="diagnosis-bad-circle">
          <circle cx="40" cy="57" r="18" />
        </clipPath>
      </defs>
    </svg>
  );
}
