"use client";

import { AlertTriangle, ArrowDownCircle, ArrowUpCircle, TrendingUp, Wallet } from "lucide-react";

import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL } from "@/lib/format";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";

const SUMMARY_CARDS = [
  { label: "Saldo financeiro", icon: Wallet },
  { label: "Contas a pagar", icon: ArrowUpCircle },
  { label: "Contas a receber", icon: ArrowDownCircle },
  { label: "Resultado do período", icon: TrendingUp },
] as const;

export default function DashboardPage() {
  const { user, currentMembership, isLoading } = useSession();

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight">Visão Geral</h1>
        <p className="text-sm text-muted-foreground">
          {currentMembership
            ? `Resumo financeiro de ${currentMembership.companyName}.`
            : "Resumo financeiro da empresa selecionada."}
        </p>
      </div>

      <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 xl:grid-cols-4">
        {SUMMARY_CARDS.map(({ label, icon: Icon }) => (
          <Card key={label}>
            <CardHeader className="flex flex-row items-center justify-between gap-2 pb-2">
              <CardTitle className="text-sm font-medium text-muted-foreground">{label}</CardTitle>
              <Icon className="size-4 text-muted-foreground" />
            </CardHeader>
            <CardContent>
              {isLoading ? (
                <Skeleton className="h-8 w-28" />
              ) : (
                <span className="text-2xl font-semibold">{formatCurrencyBRL(0)}</span>
              )}
            </CardContent>
          </Card>
        ))}
      </div>

      <Alert>
        <AlertTriangle />
        <AlertTitle>Nenhuma movimentação ainda</AlertTitle>
        <AlertDescription>
          Assim que os módulos de Contas a Pagar, Contas a Receber e Conciliação Bancária forem
          liberados, os indicadores acima e os alertas de pendências aparecerão aqui
          automaticamente.
        </AlertDescription>
      </Alert>

      {!isLoading && user && (
        <p className="text-xs text-muted-foreground">
          Sessão ativa como <span className="font-medium">{user.email}</span>
          {currentMembership ? ` · perfil ${currentMembership.role.name}` : ""}.
        </p>
      )}
    </div>
  );
}
