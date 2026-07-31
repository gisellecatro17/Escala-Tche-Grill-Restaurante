"use client";

import * as React from "react";
import Link from "next/link";
import { Info, Landmark, Search, Star, Users } from "lucide-react";

import { useBeneficiaries } from "@/lib/api/treasury";
import { useSession } from "@/lib/auth/session-context";
import { formatDocument } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/skeleton";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import { PIX_KEY_TYPE_LABELS, type Beneficiary } from "@/types/treasury";

const ENTITY_LABELS: Record<string, string> = {
  SUPPLIER: "Fornecedor",
  CUSTOMER: "Cliente",
  EMPLOYEE: "Colaborador",
  PARTNER: "Sócio",
  COMPANY: "Empresa do grupo",
  OTHER: "Outro",
};

const VERIFICATION_LABELS: Record<string, string> = {
  UNVERIFIED: "Não verificado",
  VERIFIED: "Verificado",
  FAILED: "Falhou",
  PENDING: "Pendente",
};

const SOURCE_LABELS: Record<string, string> = {
  supplier_bank_accounts: "contas bancárias de fornecedores",
  supplier_pix_keys: "chaves PIX de fornecedores",
};

function beneficiaryKey(beneficiary: Beneficiary) {
  return `${beneficiary.entityType}:${beneficiary.bankAccountId}`;
}

/**
 * Favorecidos bancários (seção 45).
 *
 * A tela é **somente leitura**: os dados vivem no cadastro de fornecedores e são
 * apresentados aqui em um lugar só. Duplicá-los criaria duas versões da mesma conta.
 */
export default function FavorecidosBancariosPage() {
  const { user, selectedCompanyId } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;

  const [search, setSearch] = React.useState("");
  const { data, isLoading } = useBeneficiaries(organizationId, {
    companyId: selectedCompanyId ?? undefined,
    search: search || undefined,
  });

  const beneficiaries = data?.items ?? [];

  return (
    <div className="mx-auto flex max-w-6xl flex-col gap-6">
      <div>
        <Button variant="ghost" size="sm" asChild className="-ml-2 mb-1">
          <Link href="/cadastros/tesouraria">
            <Landmark /> Tesouraria
          </Link>
        </Button>
        <h1 className="text-2xl font-semibold tracking-tight">
          Favorecidos Bancários
        </h1>
        <p className="text-sm text-muted-foreground">
          Contas e chaves PIX de terceiros já cadastradas, reunidas em uma visão só.
        </p>
      </div>

      <Alert>
        <Info />
        <AlertTitle>Esta tela não cadastra favorecidos</AlertTitle>
        <AlertDescription>
          Os dados vêm de{" "}
          {(data?.sources ?? []).map((source) => SOURCE_LABELS[source] ?? source)
            .join(" e ") || "cadastros existentes"}
          . Para incluir ou corrigir uma conta, edite o fornecedor correspondente — assim
          existe uma única versão de cada conta bancária.
        </AlertDescription>
      </Alert>

      <Card>
        <CardContent className="flex flex-wrap items-end gap-3">
          <div className="relative min-w-56 flex-1">
            <Search className="absolute left-2.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-8"
              placeholder="Buscar por nome ou documento"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
            />
          </div>
          {data && (
            <span className="text-sm text-muted-foreground">
              {data.total} favorecido(s)
            </span>
          )}
        </CardContent>
      </Card>

      {isLoading ? (
        <div className="flex flex-col gap-2">
          {Array.from({ length: 5 }).map((_, index) => (
            <Skeleton key={index} className="h-12 w-full" />
          ))}
        </div>
      ) : beneficiaries.length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum favorecido encontrado. Cadastre a conta bancária no fornecedor para
            que ela apareça aqui.
          </CardContent>
        </Card>
      ) : (
        <div className="overflow-x-auto rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Favorecido</TableHead>
                <TableHead className="w-28">Origem</TableHead>
                <TableHead>Instituição</TableHead>
                <TableHead className="w-40">Agência / conta</TableHead>
                <TableHead>Titular</TableHead>
                <TableHead>Chaves PIX</TableHead>
                <TableHead className="w-32">Verificação</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {beneficiaries.map((beneficiary) => (
                <TableRow key={beneficiaryKey(beneficiary)}>
                  <TableCell>
                    <span className="flex items-center gap-1.5 font-medium">
                      {beneficiary.isPrimary && (
                        <Star className="size-3.5 fill-current text-amber-500" />
                      )}
                      {beneficiary.entityType === "SUPPLIER" ? (
                        <Link
                          href={`/cadastros/fornecedores/${beneficiary.entityId}`}
                          className="underline"
                        >
                          {beneficiary.entityName}
                        </Link>
                      ) : (
                        beneficiary.entityName
                      )}
                    </span>
                    {beneficiary.entityDocument && (
                      <span className="block font-mono text-xs text-muted-foreground">
                        {formatDocument(beneficiary.entityDocument)}
                      </span>
                    )}
                  </TableCell>
                  <TableCell className="text-sm">
                    <Badge variant="outline">
                      {ENTITY_LABELS[beneficiary.entityType] ?? beneficiary.entityType}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-sm">
                    {beneficiary.institution ?? "—"}
                  </TableCell>
                  <TableCell className="font-mono text-xs">
                    {[beneficiary.branch, beneficiary.account]
                      .filter(Boolean)
                      .join(" / ") || "—"}
                  </TableCell>
                  <TableCell className="text-sm">
                    {beneficiary.holderName ?? "—"}
                    {beneficiary.isThirdParty && (
                      <Badge variant="outline" className="ml-1.5 text-[10px]">
                        Terceiro
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    {beneficiary.pixKeys.length === 0 ? (
                      <span className="text-xs text-muted-foreground">—</span>
                    ) : (
                      <ul className="flex flex-col gap-0.5">
                        {beneficiary.pixKeys.map((pixKey) => (
                          <li key={pixKey.id} className="text-xs">
                            <span className="text-muted-foreground">
                              {PIX_KEY_TYPE_LABELS[pixKey.pixType]}:
                            </span>{" "}
                            <span className="font-mono">{pixKey.pixKey ?? "—"}</span>
                          </li>
                        ))}
                      </ul>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge
                      variant={
                        beneficiary.verificationStatus === "VERIFIED"
                          ? "default"
                          : beneficiary.verificationStatus === "FAILED"
                            ? "destructive"
                            : "outline"
                      }
                    >
                      {VERIFICATION_LABELS[beneficiary.verificationStatus] ??
                        beneficiary.verificationStatus}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      <p className="flex items-center gap-1.5 text-xs text-muted-foreground">
        <Users className="size-3.5" />
        O envio de pagamentos a estes favorecidos pertence ao módulo de contas a pagar.
      </p>
    </div>
  );
}
