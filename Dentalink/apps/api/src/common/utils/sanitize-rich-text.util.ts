import {
  RICH_TEXT_ALLOWED_ATTRIBUTES,
  RICH_TEXT_ALLOWED_TAGS,
  RICH_TEXT_ALLOWED_URI_SCHEMES
} from "@dentalwarner/shared";
import sanitizeHtml from "sanitize-html";

const SHARED_ATTRIBUTES = [...RICH_TEXT_ALLOWED_ATTRIBUTES];

export function sanitizeRichTextHtml(value: string): string {
  return sanitizeHtml(value, {
    allowedTags: [...RICH_TEXT_ALLOWED_TAGS],
    allowedAttributes: {
      "*": SHARED_ATTRIBUTES.filter((attribute) => attribute === "class" || attribute === "title"),
      a: SHARED_ATTRIBUTES.filter((attribute) =>
        ["href", "target", "rel", "title", "class"].includes(attribute)
      )
    },
    allowedSchemes: [...RICH_TEXT_ALLOWED_URI_SCHEMES],
    allowProtocolRelative: false,
    disallowedTagsMode: "discard",
    transformTags: {
      a: (_tagName, attributes) => ({
        tagName: "a",
        attribs: {
          ...attributes,
          ...(attributes.href ? { target: "_blank", rel: "noopener noreferrer" } : {})
        }
      })
    }
  }).trim();
}

export function sanitizePlainText(value: string): string {
  return sanitizeHtml(value, { allowedTags: [], allowedAttributes: {} })
    // eslint-disable-next-line no-control-regex -- Plain-text inputs must not retain ASCII control characters.
    .replace(/[\u0000-\u001F\u007F]/g, "")
    .trim();
}
