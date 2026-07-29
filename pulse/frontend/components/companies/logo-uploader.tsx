"use client";

import * as React from "react";
import { Building2, Loader2, Trash2, Upload } from "lucide-react";

import { useRemoveCompanyLogo, useUploadCompanyLogo } from "@/lib/api/companies";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";

const ACCEPTED_TYPES = ["image/png", "image/jpeg", "image/webp"];
const MAX_SIZE_BYTES = 5 * 1024 * 1024;

interface LogoUploaderProps {
  companyId: string;
  logoUrl: string | null;
  displayName: string;
}

export function LogoUploader({ companyId, logoUrl, displayName }: LogoUploaderProps) {
  const inputRef = React.useRef<HTMLInputElement>(null);
  const [error, setError] = React.useState<string | null>(null);
  const upload = useUploadCompanyLogo(companyId);
  const remove = useRemoveCompanyLogo(companyId);

  function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    if (!ACCEPTED_TYPES.includes(file.type)) {
      setError("Formato inválido. Envie um arquivo PNG, JPG ou WEBP.");
      return;
    }
    if (file.size > MAX_SIZE_BYTES) {
      setError("O arquivo excede o tamanho máximo permitido (5MB).");
      return;
    }

    setError(null);
    upload.mutate(file);
  }

  return (
    <div className="flex items-center gap-4">
      <Avatar className="size-16 rounded-lg">
        <AvatarImage src={logoUrl ?? undefined} alt={displayName} />
        <AvatarFallback className="rounded-lg bg-muted">
          <Building2 className="size-6 text-muted-foreground" />
        </AvatarFallback>
      </Avatar>

      <div className="flex flex-col gap-1.5">
        <div className="flex gap-2">
          <input
            ref={inputRef}
            type="file"
            accept={ACCEPTED_TYPES.join(",")}
            className="hidden"
            onChange={handleFileChange}
          />
          <Button type="button" variant="outline" size="sm" onClick={() => inputRef.current?.click()} disabled={upload.isPending}>
            {upload.isPending ? <Loader2 className="animate-spin" /> : <Upload />}
            {logoUrl ? "Substituir logo" : "Enviar logo"}
          </Button>
          {logoUrl && (
            <Button type="button" variant="ghost" size="sm" onClick={() => remove.mutate()} disabled={remove.isPending}>
              <Trash2 />
              Remover
            </Button>
          )}
        </div>
        <p className="text-xs text-muted-foreground">PNG, JPG ou WEBP — até 5MB.</p>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </div>
    </div>
  );
}
