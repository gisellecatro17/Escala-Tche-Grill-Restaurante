"use client";

import { useEffect } from "react";
import { AlertOctagon } from "lucide-react";

import { Button } from "@/components/ui/button";

export default function GlobalError({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  useEffect(() => {
    console.error(error);
  }, [error]);

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertOctagon className="size-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Algo deu errado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Encontramos um problema inesperado ao carregar esta tela. Nossa equipe já foi notificada.
        </p>
        {error.digest && (
          <p className="text-xs text-muted-foreground">Código de referência: {error.digest}</p>
        )}
      </div>
      <Button onClick={reset}>Tentar novamente</Button>
    </div>
  );
}
