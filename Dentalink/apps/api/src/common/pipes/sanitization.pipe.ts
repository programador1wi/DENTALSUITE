import { ArgumentMetadata, Injectable, PipeTransform } from "@nestjs/common";
import { sanitizeUnknown } from "../utils/sanitize.util";

@Injectable()
export class SanitizationPipe implements PipeTransform {
  transform(value: unknown, metadata: ArgumentMetadata) {
    if (!metadata || metadata.type === "custom") return value;
    return sanitizeUnknown(value);
  }
}
