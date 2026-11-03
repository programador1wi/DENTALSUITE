export const RICH_TEXT_ALLOWED_TAGS = [
  "p",
  "br",
  "strong",
  "em",
  "u",
  "s",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
  "ul",
  "ol",
  "li",
  "blockquote",
  "code",
  "pre",
  "a",
  "hr"
] as const;

export const RICH_TEXT_ALLOWED_ATTRIBUTES = [
  "href",
  "target",
  "rel",
  "title",
  "class"
] as const;

export const RICH_TEXT_ALLOWED_URI_SCHEMES = [
  "http",
  "https",
  "mailto",
  "tel"
] as const;
