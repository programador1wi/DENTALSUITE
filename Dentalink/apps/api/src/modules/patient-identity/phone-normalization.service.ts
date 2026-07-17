import { BadRequestException, Injectable } from "@nestjs/common";
import { parsePhoneNumberFromString, type CountryCode } from "libphonenumber-js";

export type NormalizedPhone = {
  rawValue: string;
  normalizedValue: string;
  e164: string;
  countryCode: string;
  nationalNumber: string;
  callingCode: string;
  validity: "VALID";
  phoneType?: string;
  warnings: string[];
};

@Injectable()
export class PhoneNormalizationService {
  normalize(rawPhone: string, defaultCountry = "MX"): NormalizedPhone {
    const rawValue = rawPhone.trim();
    const country = defaultCountry.trim().toUpperCase() as CountryCode;
    const phone = parsePhoneNumberFromString(rawValue, country);

    if (!phone || !phone.isValid()) {
      throw new BadRequestException({
        code: "INVALID_PHONE",
        message: "El teléfono no es válido para el país seleccionado."
      });
    }

    const warnings: string[] = [];
    if (!rawValue.startsWith("+")) warnings.push("COUNTRY_INFERRED");

    return {
      rawValue,
      normalizedValue: phone.number,
      e164: phone.number,
      countryCode: phone.country ?? country,
      nationalNumber: phone.nationalNumber,
      callingCode: `+${phone.countryCallingCode}`,
      validity: "VALID",
      phoneType: phone.getType(),
      warnings
    };
  }
}
