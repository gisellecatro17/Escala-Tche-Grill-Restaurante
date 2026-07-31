import Link from "next/link";
import { AlertOctagon } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Erro",
};

export default async function GenericErrorPage({
  searchParams,
}: {
  searchParams: Promise<{ mensagem?: string }>;
}) {
  const { mensagem } = await searchParams;

  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <AlertOctagon className="size-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Não foi possível concluir a operação</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          {mensagem ?? "Ocorreu um erro inesperado. Tente novamente em instantes."}
        </p>
      </div>
      <div className="flex gap-2">
        <Button asChild variant="outline">
          <Link href="/">Voltar para o início</Link>
        </Button>
      </div>
    </div>
  );
}
