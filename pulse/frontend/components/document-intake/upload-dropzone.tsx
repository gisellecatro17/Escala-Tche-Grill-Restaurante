"use client";

import * as React from "react";
import { FileText, Upload, X } from "lucide-react";

import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

/** Extensões aceitas por padrão. Os parâmetros da empresa podem restringir mais. */
export const DEFAULT_ACCEPTED_EXTENSIONS = [
  "pdf",
  "jpg",
  "jpeg",
  "png",
  "xml",
  "xlsx",
  "xls",
  "csv",
];

export interface DropzoneFile {
  file: File;
  /** Motivo da recusa local. O back-end revalida tudo de qualquer forma. */
  localError: string | null;
}

/**
 * Área de arrastar e soltar (seções 8 e 12).
 *
 * A validação aqui é só para dar resposta imediata ao usuário — a validação que vale é a do
 * back-end, que olha o conteúdo do arquivo e não a extensão. Por isso nada é bloqueado de
 * forma definitiva neste componente: arquivos recusados aparecem marcados, e o envio manda
 * apenas os válidos.
 */
export function UploadDropzone({
  files,
  onFilesChange,
  acceptedExtensions = DEFAULT_ACCEPTED_EXTENSIONS,
  maximumFileSize = 20 * 1024 * 1024,
  maximumFiles = 20,
  multiple = true,
  capture,
}: {
  files: DropzoneFile[];
  onFilesChange: (files: DropzoneFile[]) => void;
  acceptedExtensions?: string[];
  maximumFileSize?: number;
  maximumFiles?: number;
  multiple?: boolean;
  /** Quando definido, abre a câmera do dispositivo em vez do seletor de arquivos. */
  capture?: "environment" | "user";
}) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [dragging, setDragging] = React.useState(false);

  const accept = acceptedExtensions.map((extension) => `.${extension}`).join(",");

  function validateLocally(file: File): string | null {
    const extension = file.name.split(".").pop()?.toLowerCase() ?? "";

    if (!acceptedExtensions.includes(extension)) {
      return "O formato deste arquivo não é permitido.";
    }
    if (file.size === 0) {
      return "O arquivo está vazio.";
    }
    if (file.size > maximumFileSize) {
      return `O arquivo excede o tamanho máximo permitido (${formatBytes(maximumFileSize)}).`;
    }
    return null;
  }

  function addFiles(incoming: FileList | File[]) {
    const list = Array.from(incoming).map((file) => ({
      file,
      localError: validateLocally(file),
    }));

    const combined = multiple ? [...files, ...list] : list;

    // O limite conta apenas os que seriam enviados: recusados não ocupam vaga.
    const valid = combined.filter((entry) => entry.localError === null);
    if (valid.length > maximumFiles) {
      const allowed = new Set(valid.slice(0, maximumFiles));
      onFilesChange(
        combined.map((entry) =>
          entry.localError === null && !allowed.has(entry)
            ? { ...entry, localError: `O limite é de ${maximumFiles} arquivos por envio.` }
            : entry,
        ),
      );
      return;
    }

    onFilesChange(combined);
  }

  return (
    <div className="flex flex-col gap-3">
      <div
        role="button"
        tabIndex={0}
        onClick={() => inputRef.current?.click()}
        onKeyDown={(event) => {
          if (event.key === "Enter" || event.key === " ") {
            event.preventDefault();
            inputRef.current?.click();
          }
        }}
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          if (event.dataTransfer.files.length > 0) addFiles(event.dataTransfer.files);
        }}
        className={cn(
          "flex cursor-pointer flex-col items-center gap-2 rounded-lg border-2 border-dashed p-8 text-center transition-colors",
          dragging ? "border-primary bg-primary/5" : "border-muted-foreground/30",
        )}
      >
        <Upload className={cn("size-8", dragging ? "text-primary" : "text-muted-foreground")} />
        <p className="text-sm font-medium">
          {capture
            ? "Toque para capturar o documento"
            : "Arraste os arquivos para esta área"}
        </p>
        {!capture && <p className="text-xs text-muted-foreground">ou</p>}
        <Button type="button" variant="outline" size="sm" tabIndex={-1}>
          {capture ? "Abrir câmera" : "Selecionar arquivos"}
        </Button>
        <p className="mt-1 text-xs text-muted-foreground">
          {acceptedExtensions.map((extension) => extension.toUpperCase()).join(", ")}
        </p>
        <p className="text-xs text-muted-foreground">
          Tamanho máximo por arquivo: {formatBytes(maximumFileSize)}
          {multiple && ` · até ${maximumFiles} arquivos por envio`}
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        className="hidden"
        multiple={multiple}
        accept={capture ? "image/*" : accept}
        {...(capture ? { capture } : {})}
        onChange={(event) => {
          if (event.target.files) addFiles(event.target.files);
          // Limpa para que selecionar o mesmo arquivo de novo dispare o evento.
          event.target.value = "";
        }}
      />

      {files.length > 0 && (
        <ul className="flex flex-col gap-1.5">
          {files.map((entry, index) => (
            <li
              key={`${entry.file.name}-${index}`}
              className={cn(
                "flex items-center gap-2 rounded-md border px-3 py-2 text-sm",
                entry.localError && "border-destructive/40 bg-destructive/5",
              )}
            >
              <FileText className="size-4 shrink-0 text-muted-foreground" />
              <div className="min-w-0 flex-1">
                <p className="truncate font-medium">{entry.file.name}</p>
                <p className="text-xs text-muted-foreground">
                  {formatBytes(entry.file.size)}
                  {entry.localError && (
                    <span className="text-destructive"> · {entry.localError}</span>
                  )}
                </p>
              </div>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                title="Remover"
                onClick={() => onFilesChange(files.filter((_, position) => position !== index))}
              >
                <X className="size-4" />
              </Button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

export function formatBytes(bytes: number): string {
  if (bytes >= 1024 * 1024) return `${Math.round(bytes / (1024 * 1024))} MB`;
  return `${Math.round(bytes / 1024)} KB`;
}
