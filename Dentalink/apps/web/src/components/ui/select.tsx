import React, { useState, useRef, useEffect, useLayoutEffect, useImperativeHandle } from "react";
import { createPortal } from "react-dom";
import { ChevronDown, Check, Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

export interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  containerClassName?: string;
  placeholder?: string;
  theme?: "light" | "dark";
  dropdownClassName?: string;
}

type DropdownItem =
  | { type: "group"; label: string }
  | { type: "option"; value: string; label: string; disabled: boolean };

const extractText = (children: any): string => {
  if (Array.isArray(children)) {
    return children.map(extractText).join("");
  }
  if (children == null) return "";
  return String(children);
};

export const Select = React.forwardRef<HTMLSelectElement, SelectProps>(
  ({ className, containerClassName, children, value, onChange, defaultValue, placeholder, disabled, theme = "light", dropdownClassName, ...props }, forwardedRef) => {
    const [open, setOpen] = useState(false);
    const [searchTerm, setSearchTerm] = useState("");
    const containerRef = useRef<HTMLDivElement>(null);
    const selectRef = useRef<HTMLSelectElement>(null);
    const dropdownRef = useRef<HTMLDivElement>(null);

    useImperativeHandle(forwardedRef, () => selectRef.current!);

    // Click outside handler
    useEffect(() => {
      const handleClickOutside = (event: MouseEvent) => {
        const target = event.target as Node;
        if (
          containerRef.current &&
          !containerRef.current.contains(target) &&
          (!dropdownRef.current || !dropdownRef.current.contains(target))
        ) {
          setOpen(false);
        }
      };
      if (open) {
        document.addEventListener("mousedown", handleClickOutside);
      }
      return () => document.removeEventListener("mousedown", handleClickOutside);
    }, [open]);

    // Parse options and groups from children
    const items: DropdownItem[] = [];

    React.Children.forEach(children, (child) => {
      if (!React.isValidElement(child)) return;
      const element = child as React.ReactElement<any>;

      if (element.type === "optgroup" || element.type === "OptGroup") {
        items.push({ type: "group", label: element.props.label ?? "" });
        React.Children.forEach(element.props.children, (subChild) => {
          if (React.isValidElement(subChild) && (subChild.type === "option" || subChild.type === "Option")) {
            const subElement = subChild as React.ReactElement<any>;
            items.push({
              type: "option",
              value: String(subElement.props.value ?? ""),
              label: extractText(subElement.props.children),
              disabled: Boolean(subElement.props.disabled)
            });
          }
        });
      } else if (element.type === "option" || element.type === "Option") {
        items.push({
          type: "option",
          value: String(element.props.value ?? ""),
          label: extractText(element.props.children),
          disabled: Boolean(element.props.disabled)
        });
      } else if (element.type === React.Fragment) {
        // Fallback for React fragments
        React.Children.forEach(element.props.children, (subChild) => {
          if (React.isValidElement(subChild)) {
            const subElement = subChild as React.ReactElement<any>;
            if (subElement.type === "option" || subElement.type === "Option") {
              items.push({
                type: "option",
                value: String(subElement.props.value ?? ""),
                label: extractText(subElement.props.children),
                disabled: Boolean(subElement.props.disabled)
              });
            }
          }
        });
      }
    });

    const options = items.filter((item): item is Extract<DropdownItem, { type: "option" }> => item.type === "option");

    // Track controlled vs uncontrolled value
    const [localValue, setLocalValue] = useState<string>(() => {
      if (value !== undefined) return String(value);
      if (defaultValue !== undefined) return String(defaultValue);
      return options[0]?.value ?? "";
    });

    useEffect(() => {
      if (value !== undefined) {
        setLocalValue(String(value));
      }
    }, [value]);

    // Intercept native value setter to sync with react-hook-form reset()
    useEffect(() => {
      if (!selectRef.current || value !== undefined) return;
      const selectEl = selectRef.current;
      
      if ((selectEl as any)._isIntercepted) return;

      const descriptor = Object.getOwnPropertyDescriptor(HTMLSelectElement.prototype, "value");
      if (!descriptor) return;

      const originalSet = descriptor.set;
      Object.defineProperty(selectEl, "value", {
        configurable: true,
        set(v: string) {
          originalSet?.call(selectEl, v);
          setLocalValue(v);
        },
        get() {
          return descriptor.get?.call(selectEl);
        }
      });

      (selectEl as any)._isIntercepted = true;

      // Catch any value set by react-hook-form before this effect ran
      if (selectEl.value) {
        setLocalValue((prev) => selectEl.value !== prev ? selectEl.value : prev);
      }
    }, [value]);

    const selectedOption = options.find((opt) => opt.value === localValue);
    const displayLabel = selectedOption?.label ?? placeholder ?? options[0]?.label ?? "Selecciona...";

    const handleSelect = (newValue: string) => {
      setLocalValue(newValue);
      setOpen(false);
      setSearchTerm("");

      if (selectRef.current) {
        // Native React Value setter bypass
        const nativeSelectValueSetter = Object.getOwnPropertyDescriptor(
          HTMLSelectElement.prototype,
          "value"
        )?.set;
        if (nativeSelectValueSetter) {
          nativeSelectValueSetter.call(selectRef.current, newValue);
        } else {
          selectRef.current.value = newValue;
        }

        // Dispatch synthetic change event for React & react-hook-form
        const event = new Event("change", { bubbles: true });
        selectRef.current.dispatchEvent(event);
      }
    };

    // Filter items based on search. Keep groups only if they contain matches.
    const filteredItems: DropdownItem[] = [];
    let currentGroup: { type: "group"; label: string } | null = null;
    let groupHasMatches = false;

    items.forEach((item) => {
      if (item.type === "group") {
        if (currentGroup && groupHasMatches) {
          filteredItems.push(currentGroup);
        }
        currentGroup = item;
        groupHasMatches = false;
      } else {
        const matches = item.label.toLowerCase().includes(searchTerm.toLowerCase());
        if (matches) {
          if (currentGroup) {
            filteredItems.push(currentGroup);
            currentGroup = null; // Push group header once
          }
          filteredItems.push(item);
          groupHasMatches = true;
        }
      }
    });
    if (currentGroup && groupHasMatches) {
      filteredItems.push(currentGroup);
    }

    const [coords, setCoords] = useState<{ top: number; left: number; width: number; direction: "up" | "down"; maxHeight: number }>({
      top: 0,
      left: 0,
      width: 0,
      direction: "down",
      maxHeight: 300
    });

    useLayoutEffect(() => {
      if (!open) return;

      const updateCoords = () => {
        if (containerRef.current) {
          const rect = containerRef.current.getBoundingClientRect();
          const spaceBelow = window.innerHeight - rect.bottom;
          const spaceAbove = rect.top;
          
          // Use a fixed max height for the direction calculation so it doesn't flip while filtering
          const maxExpectedHeight = 300; 
          const direction = spaceBelow < maxExpectedHeight && spaceAbove > spaceBelow ? "up" : "down";
          const top = direction === "down" ? rect.bottom + 6 : rect.top - 6;

          // Calculate max available height for the dropdown
          const availableHeight = direction === "up" ? spaceAbove - 16 : spaceBelow - 16;
          const maxHeight = Math.max(150, Math.min(300, availableHeight));

          setCoords({
            top,
            left: rect.left,
            width: rect.width,
            direction,
            maxHeight
          });
        }
      };

      updateCoords();

      window.addEventListener("resize", updateCoords);
      window.addEventListener("scroll", updateCoords, { capture: true });

      return () => {
        window.removeEventListener("resize", updateCoords);
        window.removeEventListener("scroll", updateCoords, { capture: true });
      };
    }, [open, filteredItems.length]);

    const hasSearch = options.length > 8;

    return (
      <div ref={containerRef} className={cn("relative w-full", containerClassName)}>
        {/* Hidden select for form bindings and refs */}
        <select
          ref={selectRef}
          value={localValue}
          onChange={(e) => {
            setLocalValue(e.target.value);
            if (onChange) onChange(e);
          }}
          className="sr-only"
          disabled={disabled}
          {...props}
        >
          {React.Children.toArray(children)}
        </select>

        {/* Custom Trigger */}
        <button
          type="button"
          onClick={() => !disabled && setOpen(!open)}
          className={cn(
            "flex h-10 w-full items-center justify-between rounded-[var(--radius-md)] border px-[var(--space-3)] py-[var(--space-2)] text-left text-[var(--text-sm)] shadow-sm outline-none transition-all duration-[var(--duration-fast)] ease-[var(--ease-default)] cursor-pointer",
            theme === "dark"
              ? "border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.04)] text-[rgba(248,250,252,0.85)] hover:bg-[rgba(255,255,255,0.08)] hover:border-[rgba(255,255,255,0.15)] focus:border-[var(--border-brand)] focus:ring-[var(--focus-ring)]"
              : "border-[var(--border-default)] bg-[var(--bg-surface)] text-[var(--text-primary)] hover:border-[var(--border-strong)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--focus-ring)]",
            disabled && (theme === "dark" ? "cursor-not-allowed opacity-40 bg-white/5" : "cursor-not-allowed opacity-50 bg-[var(--bg-subtle)]"),
            open && "border-[var(--border-brand)] ring-2 ring-[var(--focus-ring)]",
            className
          )}
          disabled={disabled}
        >
          <span className="line-clamp-2 pr-4 font-medium text-left" title={displayLabel}>{displayLabel}</span>
          <ChevronDown
            className={cn(
              "h-4 w-4 transition-transform duration-[var(--duration-fast)]",
              theme === "dark" ? "text-[rgba(248,250,252,0.5)]" : "text-[var(--text-secondary)]",
              open && "rotate-180 text-[var(--text-brand)]"
            )}
          />
        </button>

        {/* Custom Dropdown Panel (Portal-rendered) */}
        {open && typeof document !== "undefined" && createPortal(
          <div
            ref={dropdownRef}
            className={cn(
              "fixed z-[2000] mt-0 flex flex-col overflow-hidden rounded-[var(--radius-lg)] border p-1.5 shadow-2xl animate-in fade-in-50 duration-[var(--duration-fast)]",
              coords.top === 0 && coords.left === 0 && "opacity-0 pointer-events-none",
              coords.direction === "up" ? "slide-in-from-bottom-1 origin-bottom" : "slide-in-from-top-1 origin-top",
              theme === "dark"
                ? "border-slate-800/80 bg-slate-950/90 backdrop-blur-xl text-white shadow-2xl shadow-black/50"
                : "border-[var(--border-default)]/90 bg-white/95 backdrop-blur-md text-[var(--text-primary)] shadow-[0_12px_30px_rgba(4,44,83,0.12)]",
              dropdownClassName
            )}
            style={{
              top: coords.top,
              left: coords.left,
              width: `${Math.max(280, coords.width)}px`,
              transform: coords.direction === "up" ? "translateY(-100%)" : "none",
              maxHeight: `${coords.maxHeight}px`
            }}
          >
            {hasSearch && (
              <div className={cn(
                "flex items-center gap-2 border-b px-2 py-1.5 mb-1.5",
                theme === "dark" ? "border-slate-850/80" : "border-[var(--border-default)]/60"
              )}>
                <Search className={cn("h-3.5 w-3.5 shrink-0", theme === "dark" ? "text-slate-400" : "text-[var(--text-secondary)]")} />
                <input
                  type="text"
                  placeholder="Buscar..."
                  value={searchTerm}
                  onChange={(e) => setSearchTerm(e.target.value)}
                  className={cn(
                    "w-full bg-transparent text-[var(--text-sm)] outline-none border-none p-0 focus:ring-0 focus:outline-none",
                    theme === "dark" ? "text-white placeholder-slate-500" : "text-[var(--text-primary)] placeholder-[var(--text-secondary)]/70"
                  )}
                  autoFocus
                />
              </div>
            )}

            <div className="flex-1 min-h-0 overflow-y-auto pr-0.5 [&::-webkit-scrollbar]:w-1 [&::-webkit-scrollbar-track]:bg-transparent [&::-webkit-scrollbar-thumb]:bg-white/10 [&::-webkit-scrollbar-thumb]:rounded-full hover:[&::-webkit-scrollbar-thumb]:bg-white/20">
              {filteredItems.length > 0 ? (
                (() => {
                  let isUnderGroup = false;
                  let groupLabel = "";

                  return filteredItems.map((item, idx) => {
                    if (item.type === "group") {
                      isUnderGroup = true;
                      groupLabel = item.label;

                      const isFirstGroup = filteredItems.filter(x => x.type === "group").indexOf(item) === 0;

                      let badgeColors: string;
                      if (theme === "dark") {
                        if (item.label.includes("NORTE")) {
                          badgeColors = "border-sky-950 bg-sky-950/40 text-sky-400 shadow-sky-950/20";
                        } else if (item.label.includes("SUR")) {
                          badgeColors = "border-emerald-950 bg-emerald-950/40 text-emerald-400 shadow-emerald-950/20";
                        } else if (item.label.includes("DJWARNER")) {
                          badgeColors = "border-indigo-950 bg-indigo-950/40 text-indigo-400 shadow-indigo-950/20";
                        } else {
                          badgeColors = "border-slate-800 bg-slate-900/40 text-slate-400 shadow-slate-950/10";
                        }
                      } else {
                        if (item.label.includes("NORTE")) {
                          badgeColors = "border-sky-100 bg-sky-50 text-sky-700 shadow-sky-100/50";
                        } else if (item.label.includes("SUR")) {
                          badgeColors = "border-emerald-100 bg-emerald-50 text-emerald-700 shadow-emerald-100/50";
                        } else if (item.label.includes("DJWARNER")) {
                          badgeColors = "border-indigo-100 bg-indigo-50 text-indigo-700 shadow-indigo-100/50";
                        } else {
                          badgeColors = "border-slate-200 bg-slate-50 text-slate-600 shadow-slate-100/30";
                        }
                      }

                      return (
                        <div key={`group-${idx}`} className="mt-2.5 first:mt-1">
                          {!isFirstGroup && (
                            <div className={cn(
                              "h-px w-full mb-2",
                              theme === "dark" ? "bg-slate-800/80" : "bg-slate-250/60"
                            )} />
                          )}
                          <div className="flex items-center gap-2 mb-1.5 px-1">
                            <span className={cn(
                              "px-2 py-0.5 rounded-full text-[9px] font-extrabold uppercase tracking-widest border flex items-center gap-1 shadow-sm",
                              badgeColors
                            )}>
                              <span className="h-1.5 w-1.5 rounded-full bg-current" />
                              {item.label}
                            </span>
                            <div className={cn("h-px flex-1", theme === "dark" ? "bg-slate-800/45" : "bg-slate-150")} />
                          </div>
                        </div>
                      );
                    }

                    const isSelected = item.value === localValue;

                    let lineAccentColor = "bg-slate-300/30";
                    if (isUnderGroup) {
                      if (theme === "dark") {
                        if (groupLabel.includes("NORTE")) lineAccentColor = "bg-sky-500/20";
                        else if (groupLabel.includes("SUR")) lineAccentColor = "bg-emerald-500/20";
                        else if (groupLabel.includes("DJWARNER")) lineAccentColor = "bg-indigo-500/20";
                        else lineAccentColor = "bg-slate-700/30";
                      } else {
                        if (groupLabel.includes("NORTE")) lineAccentColor = "bg-sky-500/15";
                        else if (groupLabel.includes("SUR")) lineAccentColor = "bg-emerald-500/15";
                        else if (groupLabel.includes("DJWARNER")) lineAccentColor = "bg-indigo-500/15";
                        else lineAccentColor = "bg-slate-300/25";
                      }
                    }

                    return (
                      <button
                        key={item.value}
                        type="button"
                        disabled={item.disabled}
                        onClick={() => handleSelect(item.value)}
                        className={cn(
                          "relative flex w-full items-center justify-between rounded-[var(--radius-md)] py-1.5 text-left text-[13px] transition-colors duration-[var(--duration-fast)]",
                          isUnderGroup ? "pl-7 pr-3" : "px-3",
                          theme === "dark"
                            ? isSelected
                              ? "bg-sky-500/15 font-semibold text-sky-400"
                              : "text-slate-300 hover:bg-slate-800/40 hover:text-white"
                            : isSelected
                              ? "bg-[var(--bg-brand-light)] font-semibold text-[var(--text-brand)]"
                              : "text-[var(--text-primary)] hover:bg-[var(--bg-subtle)]/75",
                          item.disabled && "cursor-not-allowed opacity-40 hover:bg-transparent"
                        )}
                      >
                        {isUnderGroup && (
                          <div className={cn("absolute left-[14px] top-0 bottom-0 w-px", lineAccentColor)} />
                        )}
                        <span className="line-clamp-2" title={item.label}>{item.label}</span>
                        {isSelected && (
                          <Check className={cn(
                            "h-3.5 w-3.5 shrink-0 ml-2",
                            theme === "dark" ? "text-sky-400" : "text-[var(--text-brand)]"
                          )} />
                        )}
                      </button>
                    );
                  });
                })()
              ) : (
                <div className={cn(
                  "px-3 py-4 text-center text-[var(--text-sm)] italic",
                  theme === "dark" ? "text-slate-400" : "text-[var(--text-secondary)]"
                )}>
                  No se encontraron resultados
                </div>
              )}
            </div>
          </div>,
          document.body
        )}
      </div>
    );
  }
);
Select.displayName = "Select";
