import React, { useMemo } from "react";

import { RICH_TEXT_ALLOWED_ATTRIBUTES, RICH_TEXT_ALLOWED_TAGS } from "@dentalwarner/shared";
import DOMPurify from "dompurify";

export function sanitizeHtml(dirtyHtml: string): string {
  if (!dirtyHtml || typeof dirtyHtml !== "string") return "";

  if (typeof window === "undefined" || typeof DOMParser === "undefined") return "";

  const sanitized = DOMPurify.sanitize(dirtyHtml, {
    ALLOWED_TAGS: [...RICH_TEXT_ALLOWED_TAGS],
    ALLOWED_ATTR: [...RICH_TEXT_ALLOWED_ATTRIBUTES],
    ALLOW_DATA_ATTR: false,
    ALLOW_ARIA_ATTR: false,
    FORBID_TAGS: ["form", "iframe", "input", "math", "object", "script", "style", "svg", "template"],
    FORBID_ATTR: ["style"]
  });

  const document = new DOMParser().parseFromString(sanitized, "text/html");
  for (const anchor of document.querySelectorAll("a")) {
    if (!anchor.hasAttribute("href")) {
      anchor.removeAttribute("target");
      anchor.removeAttribute("rel");
      continue;
    }
    anchor.setAttribute("target", "_blank");
    anchor.setAttribute("rel", "noopener noreferrer");
  }
  return document.body.innerHTML;
}

export interface SafeHtmlProps extends React.HTMLAttributes<HTMLDivElement> {
  html: string;
  className?: string;
  as?: React.ElementType;
}

export const SafeHtml: React.FC<SafeHtmlProps> = ({
  html,
  className = "",
  as: Component = "div",
  ...props
}) => {
  const sanitized = useMemo(() => sanitizeHtml(html), [html]);

  return (
    <Component
      className={className}
      dangerouslySetInnerHTML={{ __html: sanitized }}
      {...props}
    />
  );
};

export interface SafeSvgProps extends React.HTMLAttributes<HTMLDivElement> {
  markup: string;
}

export const SafeSvg: React.FC<SafeSvgProps> = ({ markup, ...props }) => {
  const sanitized = useMemo(
    () =>
      typeof window === "undefined"
        ? ""
        : DOMPurify.sanitize(markup, {
            USE_PROFILES: { svg: true, svgFilters: true },
            FORBID_TAGS: ["foreignObject", "iframe", "script"]
          }),
    [markup]
  );
  return <div dangerouslySetInnerHTML={{ __html: sanitized }} {...props} />;
};
