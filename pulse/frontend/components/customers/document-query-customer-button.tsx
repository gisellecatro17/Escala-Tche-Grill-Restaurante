"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Loader2, Search } from "lucide-react";

import { useQueryCustomerDocument } from "@/lib/api/customers";
import { formatDocument } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import type { CustomerPersonType, CustomerRegistryData } from "@/types/customer";

interface DocumentQueryCustomerButtonProps {
  documentNumber: string;
  organizationId?: string;
  personType: CustomerPersonType;
  onApplyData: (data: CustomerRegistryData) => void;
}

/** Botão "Consultar CNPJ"/"Validar CPF" — reaproveita o mesmo provider do Cadastro de
 * Empresas/Fornecedores (seção 14 do prompt de clientes). Nunca salva sem confirmação. */
export function DocumentQueryCustomerButton({
  documentNumber,
  organizationId,
  personType,
  onApplyData,
}: DocumentQueryCustomerButtonProps) {
  const [dialogOpen, setDialogOpen] = React.useState(false);
  const mutation = useQueryCustomerDocument();

  const digits = documentNumber.replace(/\D/g, "");
  const canQuery = personType === "LEGAL_ENTITY" ? digits.length === 14 : digits.length === 11;
  const registryData =
    mutation.data && !mutation.data.duplicate && mutation.data.success ? mutation.data.data : null;

  function handleQuery() {
    setDialogOpen(true);
    mutation.mutate({ documentNumber: digits, organizationId });
  }

  function applyAndClose(data: CustomerRegistryData) {
    onApplyData(data);
    setDialogOpen(false);
  }

  return (
    <>
      <Button type="button" variant="outline" size="sm" disabled={!canQuery || personType === "FOREIGN"} onClick={handleQuery}>
        <Search />
        {personType === "INDIVIDUAL" ? "Validar CPF" : "Consultar CNPJ"}
      </Button>

      <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader>
            <DialogTitle>Consulta cadastral</DialogTitle>
            <DialogDescription>{formatDocument(digits)}</DialogDescription>
          </DialogHeader>

          {mutation.isPending && (
            <div className="flex items-center gap-2 py-6 text-sm text-muted-foreground">
              <Loader2 className="size-4 animate-spin" />
              Consultando dados cadastrais...
            </div>
          )}

          {mutation.data?.duplicate && (
            <Alert variant="destructive">
              <AlertTitle>Este cliente já está cadastrado na plataforma.</AlertTitle>
              <AlertDescription className="flex flex-col gap-2">
                <span>Cliente: {mutation.data.customer.displayName ?? mutation.data.customer.legalName}</span>
                <Button asChild variant="outline" size="sm" className="w-fit">
                  <Link href={`/cadastros/clientes/${mutation.data.customer.id}`}>Visualizar cadastro</Link>
                </Button>
              </AlertDescription>
            </Alert>
          )}

          {mutation.data && !mutation.data.duplicate && !mutation.data.success && (
            <Alert variant="warning">
              <AlertDescription>
                Não foi possível consultar o CNPJ neste momento. Você poderá tentar novamente ou preencher os dados
                manualmente.
              </AlertDescription>
            </Alert>
          )}

          {registryData && (
            <div className="flex flex-col gap-3">
              <Alert variant="success">
                <CheckCircle2 />
                <AlertTitle>CNPJ localizado com sucesso.</AlertTitle>
              </Alert>

              <dl className="grid grid-cols-1 gap-2 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-muted-foreground">Razão social</dt>
                  <dd className="font-medium">{registryData.legalName}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Nome fantasia</dt>
                  <dd className="font-medium">{registryData.tradeName ?? "—"}</dd>
                </div>
                <div>
                  <dt className="text-muted-foreground">Situação cadastral</dt>
                  <dd className="font-medium">{registryData.registrationStatus ?? "—"}</dd>
                </div>
                <div className="sm:col-span-2">
                  <dt className="text-muted-foreground">Endereço</dt>
                  <dd className="font-medium">
                    {[registryData.address?.street, registryData.address?.number, registryData.address?.district]
                      .filter(Boolean)
                      .join(", ") || "—"}
                  </dd>
                </div>
              </dl>
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => setDialogOpen(false)}>
              Cancelar
            </Button>
            {registryData && (
              <>
                <Button variant="secondary" onClick={() => applyAndClose(registryData)}>
                  Editar antes de usar
                </Button>
                <Button onClick={() => applyAndClose(registryData)}>Usar estes dados</Button>
              </>
            )}
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
