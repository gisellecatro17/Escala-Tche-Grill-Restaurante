"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FileText, Pencil, ShieldCheck, Upload, Users } from "lucide-react";

import { useCustomerDocuments, useUploadCustomerDocument, useCustomer } from "@/lib/api/customers";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateTimeBR, formatDocument } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { CustomerFinancialStatusBadge } from "@/components/customers/customer-financial-status-badge";
import { CustomerLinkStatusBadge } from "@/components/customers/customer-link-status-badge";
import { CustomerStatusBadge } from "@/components/customers/customer-status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function CustomerDocumentsTab({ customerId }: { customerId: string }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { data: documents } = useCustomerDocuments(customerId);
  const upload = useUploadCustomerDocument(customerId);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Documentos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(documents ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum documento anexado.</p>}
        <ul className="flex flex-col gap-2">
          {(documents ?? []).map((doc) => (
            <li key={doc.id} className="flex items-center gap-2 rounded-md border p-2 text-sm">
              <FileText className="size-4 text-muted-foreground" />
              {doc.fileName}
            </li>
          ))}
        </ul>
        <input
          ref={fileInputRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0];
            if (file) upload.mutate({ file });
            e.target.value = "";
          }}
        />
        <Button type="button" variant="outline" className="w-fit" onClick={() => fileInputRef.current?.click()} disabled={upload.isPending}>
          <Upload /> Incluir novo documento
        </Button>
      </CardContent>
    </Card>
  );
}

function CustomerDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "visao-geral";
  const { hasPermissionForCompany } = useSession();

  const { data: customer, isLoading } = useCustomer(params.id);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!customer) return null;

  const primaryLink = customer.companyLinks[0];
  const canUpdate = primaryLink ? hasPermissionForCompany(primaryLink.companyId, "customer.update") : false;
  const canViewCredit = primaryLink ? hasPermissionForCompany(primaryLink.companyId, "customer.view_credit_information") : false;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-lg bg-muted">
            <Users className="size-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{customer.displayName ?? customer.legalName}</h1>
              <CustomerStatusBadge status={customer.systemStatus} />
            </div>
            <p className="text-sm text-muted-foreground">{customer.legalName}</p>
            <p className="text-sm text-muted-foreground">
              {customer.normalizedDocumentNumber ? formatDocument(customer.normalizedDocumentNumber) : "Documento não informado"}
              {customer.externalRegistrationStatus ? ` · Situação cadastral: ${customer.externalRegistrationStatus}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canUpdate && (
            <Button asChild variant="outline">
              <Link href={`/cadastros/clientes/${customer.id}/editar`}>
                <Pencil /> Editar dados cadastrais
              </Link>
            </Button>
          )}
          {primaryLink && (
            <Button asChild variant="outline">
              <Link href={`/cadastros/clientes/${customer.id}/empresas/${primaryLink.id}`}>
                <ShieldCheck /> Vínculo com a empresa
              </Link>
            </Button>
          )}
        </div>
      </div>

      <Tabs defaultValue={initialTab}>
        <TabsList className="flex-wrap">
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="cadastral">Dados cadastrais</TabsTrigger>
          <TabsTrigger value="empresas">Empresas vinculadas</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InfoField label="Status no sistema" value={<CustomerStatusBadge status={customer.systemStatus} />} />
              <InfoField label="Situação cadastral" value={customer.externalRegistrationStatus} />
              <InfoField label="Segmento" value={customer.segment} />
              <InfoField label="Criado em" value={formatDateTimeBR(customer.createdAt)} />
              <InfoField label="Última atualização" value={formatDateTimeBR(customer.updatedAt)} />
              {primaryLink && (
                <>
                  <InfoField label="Categoria de receita padrão" value={primaryLink.defaultRevenueCategory?.name} />
                  <InfoField label="Centro de resultado padrão" value={primaryLink.defaultResultCenter?.name} />
                  <InfoField label="Status do vínculo" value={<CustomerLinkStatusBadge status={primaryLink.status} />} />
                  <InfoField label="Situação financeira" value={<CustomerFinancialStatusBadge status={primaryLink.financialStatus} />} />
                  <InfoField
                    label="Limite de crédito"
                    value={
                      canViewCredit
                        ? primaryLink.creditLimit != null
                          ? formatCurrencyBRL(primaryLink.creditLimit)
                          : "Não informado"
                        : "Sem permissão para visualizar"
                    }
                  />
                </>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="cadastral">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados cadastrais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoField label="Nome fantasia" value={customer.tradeName} />
              <InfoField label="Natureza jurídica" value={customer.legalNature} />
              <InfoField label="Porte" value={customer.companySize} />
              <InfoField label="Inscrição estadual" value={customer.stateRegistration} />
              <InfoField label="Inscrição municipal" value={customer.municipalRegistration} />
              <InfoField label="CNAE principal" value={customer.mainCnae} />
              <InfoField label="Telefone" value={customer.phone} />
              <InfoField label="E-mail" value={customer.email} />
              <InfoField label="E-mail financeiro" value={customer.emailFinancial} />
              <InfoField label="Site" value={customer.website} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas" className="flex flex-col gap-3">
          {customer.companyLinks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada.</p>}
          {customer.companyLinks.map((link) => (
            <Card key={link.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <Link href={`/cadastros/clientes/${customer.id}/empresas/${link.id}`} className="font-medium hover:underline">
                    {link.company?.displayName ?? link.company?.legalName ?? "—"}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {link.defaultRevenueCategory?.name ?? "Sem categoria"} · {link.defaultResultCenter?.name ?? "Sem centro de resultado"}
                  </p>
                </div>
                <div className="flex gap-2">
                  <CustomerLinkStatusBadge status={link.status} />
                  <CustomerFinancialStatusBadge status={link.financialStatus} />
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="contatos" className="flex flex-col gap-3">
          {customer.contacts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>}
          {customer.contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{[contact.position, contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
                  <div className="mt-1 flex flex-wrap gap-1">
                    {contact.isFinancialContact && <Badge variant="outline">Financeiro</Badge>}
                    {contact.isBillingContact && <Badge variant="outline">Cobrança</Badge>}
                    {contact.isContractContact && <Badge variant="outline">Contratos</Badge>}
                  </div>
                </div>
                {contact.isPrimary && <Badge>Principal</Badge>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="contratos" className="flex flex-col gap-3">
          {(primaryLink?.contracts ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>}
          {(primaryLink?.contracts ?? []).map((contract) => (
            <Card key={contract.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">{contract.contractNumber ?? "Sem número"}</p>
                  <p className="text-sm text-muted-foreground">{contract.description ?? "Sem descrição"}</p>
                </div>
                {contract.status && <Badge variant="outline">{contract.status}</Badge>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="documentos">
          <CustomerDocumentsTab customerId={customer.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CustomerDetailPage() {
  return (
    <Suspense fallback={null}>
      <CustomerDetailContent />
    </Suspense>
  );
}
