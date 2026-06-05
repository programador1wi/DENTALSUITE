import {
  type CSSProperties,
  type KeyboardEvent,
  type ReactNode,
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState
} from "react";
import { createPortal } from "react-dom";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils/cn";

const DROPDOWN_GAP = 6;
const VIEWPORT_PADDING = 12;
const MAX_DROPDOWN_HEIGHT = 320;
const MIN_DROPDOWN_HEIGHT = 96;

type DropdownPosition = {
  bottom?: number;
  top?: number;
  left: number;
  width: number;
  maxHeight: number;
};

type EntitySearchBoxProps<T> = {
  value: string;
  onValueChange: (value: string) => void;
  items: T[];
  onSelect: (item: T) => void;
  getItemKey: (item: T) => string;
  renderItem: (item: T, active: boolean) => ReactNode;
  placeholder?: string;
  loading?: boolean;
  disabled?: boolean;
  minChars?: number;
  maxResults?: number;
  debounceMs?: number;
  emptyMessage?: string;
  loadingMessage?: string;
  className?: string;
  inputClassName?: string;
  dropdownClassName?: string;
  onSubmit?: (value: string) => void;
};

export function EntitySearchBox<T>({
  value,
  onValueChange,
  items,
  onSelect,
  getItemKey,
  renderItem,
  placeholder = "Buscar",
  loading = false,
  disabled = false,
  minChars = 1,
  maxResults = 8,
  debounceMs = 220,
  emptyMessage = "Sin resultados",
  loadingMessage = "Buscando...",
  className,
  inputClassName,
  dropdownClassName,
  onSubmit
}: EntitySearchBoxProps<T>) {
  const rootRef = useRef<HTMLDivElement | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);
  const dropdownRef = useRef<HTMLDivElement | null>(null);
  const onValueChangeRef = useRef(onValueChange);
  const [inputValue, setInputValue] = useState(value);
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(0);
  const [dropdownPosition, setDropdownPosition] = useState<DropdownPosition | null>(null);

  useEffect(() => {
    onValueChangeRef.current = onValueChange;
  }, [onValueChange]);

  useEffect(() => {
    setInputValue(value);
  }, [value]);

  useEffect(() => {
    if (inputValue === value) return;

    const timeout = window.setTimeout(() => {
      onValueChangeRef.current(inputValue);
    }, debounceMs);

    return () => window.clearTimeout(timeout);
  }, [debounceMs, inputValue, value]);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!(event.target instanceof Node)) return;

      const insideInput = rootRef.current?.contains(event.target);
      const insideDropdown = dropdownRef.current?.contains(event.target);

      if (!insideInput && !insideDropdown) {
        setOpen(false);
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const trimmedValue = inputValue.trim();
  const canShow = !disabled && trimmedValue.length >= minChars;
  const visibleItems = useMemo(() => items.slice(0, maxResults), [items, maxResults]);
  const showDropdown = open && canShow;

  const updateDropdownPosition = useCallback(() => {
    if (typeof window === "undefined" || !inputRef.current) return;

    const rect = inputRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    const viewportHeight = window.innerHeight;
    const width = Math.min(Math.max(1, rect.width), viewportWidth - VIEWPORT_PADDING * 2);
    const left = Math.min(
      Math.max(VIEWPORT_PADDING, rect.left),
      Math.max(VIEWPORT_PADDING, viewportWidth - width - VIEWPORT_PADDING)
    );
    const spaceBelow = viewportHeight - rect.bottom - DROPDOWN_GAP - VIEWPORT_PADDING;
    const spaceAbove = rect.top - DROPDOWN_GAP - VIEWPORT_PADDING;
    const openUp = spaceBelow < MIN_DROPDOWN_HEIGHT * 2 && spaceAbove > spaceBelow;
    const availableHeight = Math.max(MIN_DROPDOWN_HEIGHT, openUp ? spaceAbove : spaceBelow);
    const maxHeight = Math.min(MAX_DROPDOWN_HEIGHT, availableHeight);
    const top = openUp ? undefined : Math.min(rect.bottom + DROPDOWN_GAP, viewportHeight - VIEWPORT_PADDING - maxHeight);
    const bottom = openUp ? Math.max(VIEWPORT_PADDING, viewportHeight - rect.top + DROPDOWN_GAP) : undefined;

    setDropdownPosition({ bottom, left, maxHeight, top, width });
  }, []);

  useEffect(() => {
    if (!showDropdown) {
      setDropdownPosition(null);
      return;
    }

    updateDropdownPosition();

    const handleResize = () => updateDropdownPosition();
    const handleScroll = (event: Event) => {
      if (event.target instanceof Node && dropdownRef.current?.contains(event.target)) return;
      setOpen(false);
    };

    window.addEventListener("resize", handleResize);
    window.addEventListener("scroll", handleScroll, true);

    return () => {
      window.removeEventListener("resize", handleResize);
      window.removeEventListener("scroll", handleScroll, true);
    };
  }, [showDropdown, updateDropdownPosition]);

  useEffect(() => {
    setActiveIndex(0);
  }, [trimmedValue, visibleItems.length]);

  const selectItem = (item: T) => {
    onSelect(item);
    setOpen(false);
    inputRef.current?.blur();
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLInputElement>) => {
    if (event.key === "Escape") {
      setOpen(false);
      return;
    }

    if (!showDropdown) {
      if (event.key === "Enter") {
        event.preventDefault();
        onSubmit?.(trimmedValue);
      }
      return;
    }

    if (event.key === "ArrowDown") {
      event.preventDefault();
      setActiveIndex((current) => Math.min(current + 1, Math.max(visibleItems.length - 1, 0)));
      return;
    }

    if (event.key === "ArrowUp") {
      event.preventDefault();
      setActiveIndex((current) => Math.max(current - 1, 0));
      return;
    }

    if (event.key === "Enter") {
      event.preventDefault();
      const selected = visibleItems[activeIndex];
      if (selected) selectItem(selected);
      else onSubmit?.(trimmedValue);
    }
  };

  const dropdownStyle: CSSProperties | undefined = dropdownPosition
    ? {
        left: dropdownPosition.left,
        maxHeight: dropdownPosition.maxHeight,
        top: dropdownPosition.top,
        width: dropdownPosition.width
      }
    : undefined;

  const dropdown =
    showDropdown && dropdownPosition && typeof document !== "undefined"
      ? createPortal(
          <div
            ref={dropdownRef}
            className={cn(
              "fixed z-[1100] overflow-y-auto rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] p-1 shadow-[var(--shadow-modal)]",
              dropdownClassName
            )}
            style={dropdownStyle}
            role="listbox"
          >
            {loading ? (
              <div className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">{loadingMessage}</div>
            ) : visibleItems.length ? (
              visibleItems.map((item, index) => {
                const active = index === activeIndex;
                return (
                  <button
                    key={getItemKey(item)}
                    type="button"
                    role="option"
                    aria-selected={active}
                    onMouseDown={(event) => event.preventDefault()}
                    onClick={() => selectItem(item)}
                    className={cn(
                      "w-full rounded-[var(--radius-sm)] px-3 py-2 text-left transition-colors",
                      active ? "bg-[var(--bg-brand-light)]" : "hover:bg-[var(--bg-subtle)]"
                    )}
                  >
                    {renderItem(item, active)}
                  </button>
                );
              })
            ) : (
              <div className="px-3 py-2 text-xs font-medium text-[var(--text-secondary)]">{emptyMessage}</div>
            )}
          </div>,
          document.body
        )
      : null;

  return (
    <>
      <div ref={rootRef} className={cn("relative", className)}>
        <Search className="pointer-events-none absolute left-3 top-1/2 z-10 h-4 w-4 -translate-y-1/2 text-[var(--text-secondary)]" />
        <input
          ref={inputRef}
          type="text"
          value={inputValue}
          disabled={disabled}
          placeholder={placeholder}
          onFocus={() => setOpen(true)}
          onChange={(event) => {
            setInputValue(event.target.value);
            setOpen(true);
          }}
          onKeyDown={handleKeyDown}
          className={cn(
            "h-10 w-full rounded-[var(--radius-md)] border border-[var(--border-default)] bg-[var(--bg-surface)] pl-10 pr-3 text-[var(--text-sm)] text-[var(--text-primary)] outline-none transition-[border-color,box-shadow] duration-[var(--duration-fast)] ease-[var(--ease-default)] placeholder:text-[var(--text-secondary)] focus:border-[var(--border-brand)] focus:ring-2 focus:ring-[var(--focus-ring)] disabled:cursor-not-allowed disabled:opacity-60",
            inputClassName
          )}
          role="combobox"
          aria-expanded={showDropdown}
          aria-autocomplete="list"
        />
      </div>
      {dropdown}
    </>
  );
}
