import Link from "next/link";
import { ShieldAlert } from "lucide-react";

import { Button } from "@/components/ui/button";

export const metadata = {
  title: "Acesso negado",
};

export default function AccessDeniedPage() {
  return (
    <div className="flex min-h-dvh flex-col items-center justify-center gap-4 p-6 text-center">
      <div className="flex size-16 items-center justify-center rounded-full bg-destructive/10">
        <ShieldAlert className="size-8 text-destructive" />
      </div>
      <div className="space-y-1">
        <h1 className="text-xl font-semibold">Acesso negado</h1>
        <p className="max-w-sm text-sm text-muted-foreground">
          Você não tem permissão para acessar esta tela nesta empresa. Se acredita que isso é um
          engano, entre em contato com o administrador da sua organização.
        </p>
      </div>
      <Button asChild>
        <Link href="/">Voltar para o início</Link>
      </Button>
    </div>
  );
}
