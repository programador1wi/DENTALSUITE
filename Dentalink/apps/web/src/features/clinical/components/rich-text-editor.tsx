import {
  Bold,
  Italic,
  Underline,
  Strikethrough,
  List,
  ListOrdered,
  Type,
  Plus,
  Mic,
  MessageSquare
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select } from "@/components/ui/select";
import { HelpTooltip } from "@/components/ui/help-tooltip";
import { useRef, useEffect, useCallback, useState, MouseEvent } from "react";

interface RichTextEditorProps {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  onUseTemplate?: () => void;
  onDictate?: () => void;
  onFeedback?: () => void;
  className?: string;
}

export function RichTextEditor({
  value,
  onChange,
  placeholder = "Escribe o dicta la evolución",
  onUseTemplate,
  onDictate,
  onFeedback,
  className
}: RichTextEditorProps) {
  const editorRef = useRef<HTMLDivElement>(null);
  const savedRangeRef = useRef<Range | null>(null);
  const [formatVal, setFormatVal] = useState("parrafo");

  const saveSelection = useCallback(() => {
    const sel = window.getSelection();
    if (sel && sel.rangeCount > 0) {
      const range = sel.getRangeAt(0);
      if (editorRef.current && editorRef.current.contains(range.commonAncestorContainer)) {
        savedRangeRef.current = range.cloneRange();
      }
    }
  }, []);

  const restoreSelection = useCallback(() => {
    if (savedRangeRef.current) {
      const sel = window.getSelection();
      if (sel) {
        sel.removeAllRanges();
        sel.addRange(savedRangeRef.current);
      }
    }
  }, []);

  useEffect(() => {
    const handleSelectionChange = () => {
      saveSelection();
    };
    document.addEventListener("selectionchange", handleSelectionChange);
    return () => {
      document.removeEventListener("selectionchange", handleSelectionChange);
    };
  }, [saveSelection]);

  // Sync value from props to contentEditable if it changes externally
  useEffect(() => {
    if (editorRef.current && value !== editorRef.current.innerHTML) {
      if (document.activeElement !== editorRef.current) {
        editorRef.current.innerHTML = value;
      }
    }
  }, [value]);

  const handleInput = useCallback(() => {
    if (editorRef.current) {
      onChange(editorRef.current.innerHTML);
    }
  }, [onChange]);

  const executeCommand = (command: string, arg?: string, e?: MouseEvent<HTMLButtonElement> | React.ChangeEvent<HTMLSelectElement>) => {
    if (e) e.preventDefault(); // Prevent losing focus
    restoreSelection();
    document.execCommand(command, false, arg);
    if (editorRef.current) {
      editorRef.current.focus();
    }
    setTimeout(saveSelection, 10);
    handleInput();
  };

  return (
    <div className={`flex flex-col rounded-md border border-slate-200 bg-white focus-within:ring-2 focus-within:ring-blue-500 focus-within:ring-offset-2 ${className || ""}`}>
      {/* Toolbar */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-200 bg-slate-50/50 p-2">
        <div className="flex flex-wrap items-center gap-1.5">
          <select 
            value={formatVal}
            className="h-10 w-[125px] rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-sm font-medium text-slate-700 outline-none hover:bg-slate-50 hover:border-slate-300 transition-all cursor-pointer shadow-sm"
            onChange={(e) => {
              const val = e.target.value;
              setFormatVal(val);
              if (val === 'h1') executeCommand('formatBlock', 'H1', e);
              else if (val === 'h2') executeCommand('formatBlock', 'H2', e);
              else executeCommand('formatBlock', 'P', e);
            }}
          >
            <option value="parrafo">Párrafo</option>
            <option value="h1">Título 1</option>
            <option value="h2">Título 2</option>
          </select>

          <div className="mx-1.5 h-5 w-px bg-slate-300" />

          <button 
            type="button" 
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors focus-visible:outline-none" 
            onMouseDown={(e) => executeCommand('bold', undefined, e)}
            title="Negrita"
          >
            <Bold className="h-5 w-5" />
          </button>
          <button 
            type="button" 
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors focus-visible:outline-none" 
            onMouseDown={(e) => executeCommand('italic', undefined, e)}
            title="Cursiva"
          >
            <Italic className="h-5 w-5" />
          </button>
          <button 
            type="button" 
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors focus-visible:outline-none" 
            onMouseDown={(e) => executeCommand('underline', undefined, e)}
            title="Subrayado"
          >
            <Underline className="h-5 w-5" />
          </button>
          <button 
            type="button" 
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors focus-visible:outline-none" 
            onMouseDown={(e) => executeCommand('strikeThrough', undefined, e)}
            title="Tachado"
          >
            <Strikethrough className="h-5 w-5" />
          </button>

          <div className="mx-1.5 h-5 w-px bg-slate-300" />

          <button 
            type="button" 
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors focus-visible:outline-none" 
            onMouseDown={(e) => executeCommand('insertUnorderedList', undefined, e)}
            title="Lista con viñetas"
          >
            <List className="h-5 w-5" />
          </button>
          <button 
            type="button" 
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors focus-visible:outline-none" 
            onMouseDown={(e) => executeCommand('insertOrderedList', undefined, e)}
            title="Lista numerada"
          >
            <ListOrdered className="h-5 w-5" />
          </button>

          <div className="mx-1.5 h-5 w-px bg-slate-300" />

          <button 
            type="button" 
            className="flex h-10 w-10 items-center justify-center rounded-md text-slate-600 hover:bg-slate-200/60 hover:text-slate-900 transition-colors focus-visible:outline-none" 
            onMouseDown={(e) => executeCommand('removeFormat', undefined, e)}
            title="Limpiar formato"
          >
            <Type className="h-5 w-5" />
          </button>
        </div>

        {onUseTemplate && (
          <button 
            type="button" 
            className="inline-flex items-center justify-center rounded-md bg-slate-800 px-3 py-1.5 text-xs font-medium text-white transition-colors hover:bg-slate-700 focus:outline-none focus:ring-2 focus:ring-slate-400 focus:ring-offset-1"
            onClick={onUseTemplate}
          >
            <Plus className="mr-1 h-3.5 w-3.5" /> Usar plantilla
          </button>
        )}
      </div>

      {/* Editor Area */}
      <div className="p-3">
        <div
          ref={editorRef}
          contentEditable
          onInput={handleInput}
          onBlur={handleInput}
          data-placeholder={placeholder}
          className="min-h-[250px] w-full bg-transparent text-sm text-slate-900 outline-none empty:before:content-[attr(data-placeholder)] empty:before:text-slate-400 prose prose-sm max-w-none prose-p:my-1 prose-ul:my-1 prose-ol:my-1 [&_ul]:list-disc [&_ol]:list-decimal [&_ul]:pl-6 [&_ol]:pl-6 [&_li]:list-item [&_ul]:my-2 [&_ol]:my-2 [&_li]:my-0.5"
        />
      </div>

      {/* Bottom Bar */}
      <div className="flex items-center justify-end gap-2 border-t border-slate-100 p-2">
        {onFeedback && (
          <Button type="button" variant="ghost" size="sm" className="h-8 text-slate-500 hover:text-slate-700" onClick={onFeedback}>
            <MessageSquare className="mr-1.5 h-3.5 w-3.5" /> Danos tu opinión
          </Button>
        )}
        {onDictate && (
          <Button type="button" variant="secondary" size="sm" className="h-8 bg-slate-100 text-slate-600 hover:bg-slate-200 hover:text-slate-900" onClick={onDictate}>
            Dictar <Mic className="ml-1.5 h-3.5 w-3.5" />
          </Button>
        )}
      </div>
    </div>
  );
}
