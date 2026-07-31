"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { FileText, Pencil, ShieldCheck, Truck, Upload } from "lucide-react";

import { useSupplierDocuments, useUploadSupplierDocument, useSupplier } from "@/lib/api/suppliers";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR, formatDocument } from "@/lib/format";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { SupplierLinkStatusBadge } from "@/components/suppliers/supplier-link-status-badge";
import { SupplierStatusBadge } from "@/components/suppliers/supplier-status-badge";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function SupplierDocumentsTab({ supplierId }: { supplierId: string }) {
  const fileInputRef = React.useRef<HTMLInputElement>(null);
  const { data: documents } = useSupplierDocuments(supplierId);
  const upload = useUploadSupplierDocument(supplierId);

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

function SupplierDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "visao-geral";
  const { hasPermissionForCompany } = useSession();

  const { data: supplier, isLoading } = useSupplier(params.id);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!supplier) return null;

  const primaryLink = supplier.companyLinks[0];
  const canUpdate = primaryLink ? hasPermissionForCompany(primaryLink.companyId, "supplier.update") : false;
  const canManageBankData = primaryLink ? hasPermissionForCompany(primaryLink.companyId, "supplier.manage_bank_data") : false;

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          <div className="flex size-16 items-center justify-center rounded-lg bg-muted">
            <Truck className="size-6 text-muted-foreground" />
          </div>
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{supplier.displayName ?? supplier.legalName}</h1>
              <SupplierStatusBadge status={supplier.systemStatus} />
            </div>
            <p className="text-sm text-muted-foreground">{supplier.legalName}</p>
            <p className="text-sm text-muted-foreground">
              {supplier.normalizedDocumentNumber ? formatDocument(supplier.normalizedDocumentNumber) : "Documento não informado"}
              {supplier.externalRegistrationStatus ? ` · Situação cadastral: ${supplier.externalRegistrationStatus}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canUpdate && (
            <Button asChild variant="outline">
              <Link href={`/cadastros/fornecedores/${supplier.id}/editar`}>
                <Pencil /> Editar dados cadastrais
              </Link>
            </Button>
          )}
          {primaryLink && canManageBankData && (
            <Button asChild variant="outline">
              <Link href={`/cadastros/fornecedores/${supplier.id}/empresas/${primaryLink.id}`}>
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
          <TabsTrigger value="bancario">Dados bancários</TabsTrigger>
          <TabsTrigger value="pix">Chaves PIX</TabsTrigger>
          <TabsTrigger value="documentos">Documentos</TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InfoField label="Status no sistema" value={<SupplierStatusBadge status={supplier.systemStatus} />} />
              <InfoField label="Situação cadastral" value={supplier.externalRegistrationStatus} />
              <InfoField label="Segmento" value={supplier.segment} />
              <InfoField label="Criado em" value={formatDateTimeBR(supplier.createdAt)} />
              <InfoField label="Última atualização" value={formatDateTimeBR(supplier.updatedAt)} />
              {primaryLink && (
                <>
                  <InfoField label="Categoria padrão" value={primaryLink.defaultCategory?.name} />
                  <InfoField label="Centro de custo padrão" value={primaryLink.defaultCostCenter?.name} />
                  <InfoField label="Status do vínculo" value={<SupplierLinkStatusBadge status={primaryLink.status} />} />
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
              <InfoField label="Nome fantasia" value={supplier.tradeName} />
              <InfoField label="Natureza jurídica" value={supplier.legalNature} />
              <InfoField label="Porte" value={supplier.companySize} />
              <InfoField label="Inscrição estadual" value={supplier.stateRegistration} />
              <InfoField label="Inscrição municipal" value={supplier.municipalRegistration} />
              <InfoField label="CNAE principal" value={supplier.mainCnae} />
              <InfoField label="Telefone" value={supplier.phone} />
              <InfoField label="E-mail" value={supplier.email} />
              <InfoField label="Site" value={supplier.website} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="empresas" className="flex flex-col gap-3">
          {supplier.companyLinks.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma empresa vinculada.</p>}
          {supplier.companyLinks.map((link) => (
            <Card key={link.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <Link href={`/cadastros/fornecedores/${supplier.id}/empresas/${link.id}`} className="font-medium hover:underline">
                    {link.company?.displayName ?? link.company?.legalName ?? "—"}
                  </Link>
                  <p className="text-sm text-muted-foreground">
                    {link.defaultCategory?.name ?? "Sem categoria"} · {link.defaultCostCenter?.name ?? "Sem centro de custo"}
                  </p>
                </div>
                <SupplierLinkStatusBadge status={link.status} />
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="contatos" className="flex flex-col gap-3">
          {supplier.contacts.length === 0 && <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>}
          {supplier.contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">{[contact.position, contact.phone, contact.email].filter(Boolean).join(" · ")}</p>
                </div>
                {contact.isPrimary && <Badge>Principal</Badge>}
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="bancario" className="flex flex-col gap-3">
          {supplier.bankAccounts.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma conta bancária cadastrada.</p>}
          {supplier.bankAccounts.map((account) => (
            <Card key={account.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">
                    {account.financialInstitution?.shortName ?? account.financialInstitution?.legalName ?? "Banco não informado"}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    Agência {account.branchNumber} · Conta {account.accountNumber} · {account.holderName}
                  </p>
                </div>
                <div className="flex gap-2">
                  {account.isThirdParty && <Badge variant="warning">Terceiro</Badge>}
                  {account.isPrimary && <Badge>Principal</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="pix" className="flex flex-col gap-3">
          {supplier.pixKeys.length === 0 && <p className="text-sm text-muted-foreground">Nenhuma chave PIX cadastrada.</p>}
          {supplier.pixKeys.map((key) => (
            <Card key={key.id}>
              <CardContent className="flex items-center justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">{key.pixKey}</p>
                  <p className="text-sm text-muted-foreground">{key.pixType} · {key.holderName}</p>
                </div>
                <div className="flex gap-2">
                  {key.isThirdParty && <Badge variant="warning">Terceiro</Badge>}
                  {key.isPrimary && <Badge>Principal</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="documentos">
          <SupplierDocumentsTab supplierId={supplier.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function SupplierDetailPage() {
  return (
    <Suspense fallback={null}>
      <SupplierDetailContent />
    </Suspense>
  );
}
