import type { Branch, BranchPayload } from "@/features/settings/branches/services/branches.service";
import type { BrandPayload, HealthCenterBrand } from "../services/health-center.service";

export type BrandFormState = {
  name: string;
  legalName: string;
  shortName: string;
  slug: string;
  description: string;
  logoUrl: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  domain: string;
  publicDomain: string;
  senderName: string;
  senderEmail: string;
  replyToEmail: string;
  phone: string;
  website: string;
  privacyNoticeUrl: string;
  isDefault: boolean;
};

export type BranchFormState = {
  brandId: string;
  code: string;
  name: string;
  description: string;
  status: "ACTIVE" | "INACTIVE";
  address: string;
  exteriorNumber: string;
  interiorNumber: string;
  neighborhood: string;
  postalCode: string;
  country: string;
  state: string;
  city: string;
  municipality: string;
  references: string;
  timezone: string;
  countryCode: string;
  phone: string;
  secondaryPhone: string;
  email: string;
  replyToEmail: string;
  website: string;
  showInEmails: boolean;
  showInDocuments: boolean;
  showInOnlineScheduling: boolean;
  allowOnlineAppointments: boolean;
  allowNotifications: boolean;
};

export const emptyBrandForm: BrandFormState = {
  name: "",
  legalName: "",
  shortName: "",
  slug: "",
  description: "",
  logoUrl: "",
  primaryColor: "#0f766e",
  secondaryColor: "#0f172a",
  accentColor: "",
  domain: "",
  publicDomain: "",
  senderName: "",
  senderEmail: "",
  replyToEmail: "",
  phone: "",
  website: "",
  privacyNoticeUrl: "",
  isDefault: false
};

export const emptyBranchForm: BranchFormState = {
  brandId: "",
  code: "",
  name: "",
  description: "",
  status: "ACTIVE",
  address: "",
  exteriorNumber: "",
  interiorNumber: "",
  neighborhood: "",
  postalCode: "",
  country: "MX",
  state: "",
  city: "",
  municipality: "",
  references: "",
  timezone: "America/Mexico_City",
  countryCode: "+52",
  phone: "",
  secondaryPhone: "",
  email: "",
  replyToEmail: "",
  website: "",
  showInEmails: true,
  showInDocuments: true,
  showInOnlineScheduling: true,
  allowOnlineAppointments: true,
  allowNotifications: true
};

export function brandToForm(brand: HealthCenterBrand): BrandFormState {
  return {
    name: brand.name ?? "",
    legalName: brand.legalName ?? "",
    shortName: brand.shortName ?? "",
    slug: brand.slug ?? "",
    description: brand.description ?? "",
    logoUrl: brand.logoUrl ?? "",
    primaryColor: brand.primaryColor ?? "#0f766e",
    secondaryColor: brand.secondaryColor ?? "#0f172a",
    accentColor: brand.accentColor ?? "",
    domain: brand.domain ?? "",
    publicDomain: brand.publicDomain ?? "",
    senderName: brand.senderName ?? "",
    senderEmail: brand.senderEmail ?? "",
    replyToEmail: brand.replyToEmail ?? "",
    phone: brand.phone ?? "",
    website: brand.website ?? "",
    privacyNoticeUrl: brand.privacyNoticeUrl ?? "",
    isDefault: brand.isDefault
  };
}

export function branchToForm(branch: Branch): BranchFormState {
  return {
    ...emptyBranchForm,
    brandId: branch.brandId ?? "",
    code: branch.code ?? "",
    name: branch.name ?? "",
    description: branch.description ?? "",
    status: branch.status,
    address: branch.address ?? "",
    exteriorNumber: branch.exteriorNumber ?? "",
    interiorNumber: branch.interiorNumber ?? "",
    neighborhood: branch.neighborhood ?? "",
    postalCode: branch.postalCode ?? "",
    country: branch.country ?? "MX",
    state: branch.state ?? "",
    city: branch.city ?? "",
    municipality: branch.municipality ?? "",
    references: branch.references ?? "",
    timezone: branch.timezone ?? "America/Mexico_City",
    countryCode: branch.countryCode ?? "+52",
    phone: branch.phone ?? "",
    secondaryPhone: branch.secondaryPhone ?? "",
    email: branch.email ?? "",
    replyToEmail: branch.replyToEmail ?? "",
    website: branch.website ?? "",
    showInEmails: branch.showInEmails ?? true,
    showInDocuments: branch.showInDocuments ?? true,
    showInOnlineScheduling: branch.showInOnlineScheduling ?? true,
    allowOnlineAppointments: branch.allowOnlineAppointments ?? true,
    allowNotifications: branch.allowNotifications ?? true
  };
}

export function cleanBrandPayload(form: BrandFormState): BrandPayload {
  return {
    ...form,
    slug: form.slug || undefined,
    legalName: form.legalName || undefined,
    shortName: form.shortName || undefined,
    description: form.description || undefined,
    logoUrl: form.logoUrl || undefined,
    accentColor: form.accentColor || undefined,
    domain: form.domain || undefined,
    publicDomain: form.publicDomain || undefined,
    senderName: form.senderName || undefined,
    senderEmail: form.senderEmail || undefined,
    replyToEmail: form.replyToEmail || undefined,
    phone: form.phone || undefined,
    website: form.website || undefined,
    privacyNoticeUrl: form.privacyNoticeUrl || undefined
  };
}

export function cleanBranchPayload(
  form: BranchFormState,
  editing: boolean
): Partial<BranchPayload> & { status?: "ACTIVE" | "INACTIVE" } {
  const normalizedPhone = normalizePhone(form.countryCode, form.phone);
  return {
    ...(editing ? {} : { code: form.code }),
    name: form.name,
    brandId: form.brandId,
    description: form.description || undefined,
    status: form.status,
    address: form.address || undefined,
    exteriorNumber: form.exteriorNumber || undefined,
    interiorNumber: form.interiorNumber || undefined,
    neighborhood: form.neighborhood || undefined,
    postalCode: form.postalCode || undefined,
    country: form.country || "MX",
    state: form.state || undefined,
    city: form.city || undefined,
    municipality: form.municipality || undefined,
    references: form.references || undefined,
    timezone: form.timezone || "America/Mexico_City",
    countryCode: form.countryCode,
    phone: normalizedPhone || undefined,
    secondaryPhone: form.secondaryPhone || undefined,
    email: form.email || undefined,
    replyToEmail: form.replyToEmail || undefined,
    website: form.website || undefined,
    showInEmails: form.showInEmails,
    showInDocuments: form.showInDocuments,
    showInOnlineScheduling: form.showInOnlineScheduling,
    allowOnlineAppointments: form.allowOnlineAppointments,
    allowNotifications: form.allowNotifications
  };
}

export function validateBrand(form: BrandFormState) {
  if (!form.name.trim()) return "El nombre de la marca es obligatorio.";
  const colorRegex = /^#[0-9a-f]{6}$/i;
  if (!colorRegex.test(form.primaryColor) || !colorRegex.test(form.secondaryColor)) {
    return "Los colores deben estar en formato hexadecimal.";
  }
  if (form.slug && !/^[a-z0-9-]+$/i.test(form.slug)) {
    return "El identificador solo puede usar letras, números y guiones.";
  }
  if (form.domain && !isValidDomain(form.domain)) return "El dominio no tiene un formato válido.";
  if (form.publicDomain && !isValidDomain(form.publicDomain)) return "El dominio público no tiene un formato válido.";
  return "";
}

export function validateBranch(form: BranchFormState) {
  if (!form.brandId) return "Selecciona una marca.";
  if (!form.name.trim()) return "El nombre de sucursal es obligatorio.";
  if (!form.code.trim()) return "El código de sucursal es obligatorio.";
  if (form.countryCode === "+52" && form.phone && digits(form.phone).length !== 10) {
    return "Ingresa un número mexicano válido de 10 dígitos.";
  }
  return "";
}

function isValidDomain(value: string) {
  return /^(?!-)(?:[a-z0-9-]{1,63}\.)+[a-z]{2,63}$/i.test(value.replace(/^https?:\/\//, "").replace(/\/.*$/, ""));
}

function normalizePhone(countryCode: string, phone: string) {
  const number = digits(phone);
  if (!number) return "";
  return `${countryCode}${number}`;
}

function digits(value: string) {
  return value.replace(/\D/g, "");
}
