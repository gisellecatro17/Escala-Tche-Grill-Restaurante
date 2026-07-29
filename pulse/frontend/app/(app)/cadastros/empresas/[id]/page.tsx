"use client";

import * as React from "react";
import { Suspense } from "react";
import Link from "next/link";
import { useParams, useSearchParams } from "next/navigation";
import { AlertTriangle, Building2, History, Landmark, Pencil, UserCog } from "lucide-react";

import {
  useCompany,
  useCompanyActivationPendencies,
  useCompanyAuditLog,
  useCompanyUsers,
} from "@/lib/api/companies";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL, formatDateTimeBR, formatDocument } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { CompanyRowActions } from "@/components/companies/company-row-actions";
import { CompanyStatusBadge } from "@/components/companies/company-status-badge";
import { LogoUploader } from "@/components/companies/logo-uploader";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  ACCOUNTING_CRITERION_LABELS,
  ADDRESS_TYPE_LABELS,
  COMPANY_SYSTEM_STATUS_LABELS,
  CONTACT_TYPE_LABELS,
  ESTABLISHMENT_TYPE_LABELS,
  TAX_REGIME_LABELS,
} from "@/types/company";

function InfoField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="text-sm font-medium">{value ?? "—"}</dd>
    </div>
  );
}

function CompanyDetailContent() {
  const params = useParams<{ id: string }>();
  const searchParams = useSearchParams();
  const initialTab = searchParams.get("tab") ?? "visao-geral";
  const { hasPermissionForCompany } = useSession();

  const { data: company, isLoading } = useCompany(params.id);
  const { data: pendencies } = useCompanyActivationPendencies(params.id);
  const { data: memberships } = useCompanyUsers(params.id);
  const [auditPage, setAuditPage] = React.useState(1);
  const { data: auditLog } = useCompanyAuditLog(params.id, auditPage);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-5xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!company) {
    return null;
  }

  const canManageUsers = hasPermissionForCompany(company.id, "company.manage_users");
  const canUpdate = hasPermissionForCompany(company.id, "company.update");
  const canViewAudit = hasPermissionForCompany(company.id, "company.view_audit");
  const canManageLogo = hasPermissionForCompany(company.id, "company.manage_logo");

  return (
    <div className="mx-auto flex max-w-5xl flex-col gap-6">
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="flex items-center gap-4">
          {canManageLogo ? (
            <LogoUploader companyId={company.id} logoUrl={company.logoUrl} displayName={company.displayName ?? ""} />
          ) : (
            <div className="flex size-16 items-center justify-center rounded-lg bg-muted">
              <Building2 className="size-6 text-muted-foreground" />
            </div>
          )}
          <div>
            <div className="flex items-center gap-2">
              <h1 className="text-2xl font-semibold tracking-tight">{company.displayName ?? company.legalName}</h1>
              <CompanyStatusBadge status={company.systemStatus} />
            </div>
            <p className="text-sm text-muted-foreground">{company.legalName}</p>
            <p className="text-sm text-muted-foreground">
              {company.normalizedDocumentNumber ? formatDocument(company.normalizedDocumentNumber) : "Documento não informado"}
              {company.externalRegistrationStatus ? ` · Situação cadastral: ${company.externalRegistrationStatus}` : ""}
            </p>
          </div>
        </div>

        <div className="flex flex-wrap gap-2">
          {canUpdate && (
            <Button asChild variant="outline">
              <Link href={`/cadastros/empresas/${company.id}/editar`}>
                <Pencil /> Editar empresa
              </Link>
            </Button>
          )}
          {canManageUsers && (
            <Button asChild variant="outline">
              <Link href={`/cadastros/empresas/${company.id}?tab=usuarios`}>
                <UserCog /> Gerenciar usuários
              </Link>
            </Button>
          )}
          <Button variant="outline" disabled>
            <Landmark /> Contas bancárias
          </Button>
          <CompanyRowActions company={company} />
        </div>
      </div>

      {pendencies && pendencies.length > 0 && company.systemStatus !== "ACTIVE" && (
        <Alert variant="warning">
          <AlertTriangle />
          <AlertTitle>Pendências para ativação</AlertTitle>
          <AlertDescription>
            <ul className="list-inside list-disc">
              {pendencies.map((p) => (
                <li key={p}>{p}</li>
              ))}
            </ul>
          </AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue={initialTab}>
        <TabsList>
          <TabsTrigger value="visao-geral">Visão geral</TabsTrigger>
          <TabsTrigger value="identificacao">Identificação</TabsTrigger>
          <TabsTrigger value="enderecos">Endereços</TabsTrigger>
          <TabsTrigger value="contatos">Contatos</TabsTrigger>
          <TabsTrigger value="fiscal">Fiscal</TabsTrigger>
          <TabsTrigger value="financeiro">Financeiro</TabsTrigger>
          <TabsTrigger value="usuarios">Usuários</TabsTrigger>
          <TabsTrigger value="historico">
            <History className="size-3.5" /> Histórico
          </TabsTrigger>
        </TabsList>

        <TabsContent value="visao-geral" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Resumo</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-4">
              <InfoField label="Código interno" value={company.internalCode} />
              <InfoField label="Tipo" value={ESTABLISHMENT_TYPE_LABELS[company.establishmentType]} />
              <InfoField label="Status no sistema" value={COMPANY_SYSTEM_STATUS_LABELS[company.systemStatus]} />
              <InfoField label="Situação cadastral" value={company.externalRegistrationStatus} />
              <InfoField label="Criada em" value={formatDateTimeBR(company.createdAt)} />
              <InfoField label="Última atualização" value={formatDateTimeBR(company.updatedAt)} />
              {company.parentCompany && (
                <InfoField
                  label="Empresa matriz"
                  value={
                    <Link href={`/cadastros/empresas/${company.parentCompany.id}`} className="hover:underline">
                      {company.parentCompany.displayName ?? company.parentCompany.legalName}
                    </Link>
                  }
                />
              )}
              {company.branches.length > 0 && (
                <InfoField label="Filiais" value={`${company.branches.length} vinculada(s)`} />
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="identificacao">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Dados cadastrais</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-2 gap-4 sm:grid-cols-3">
              <InfoField label="Nome fantasia" value={company.tradeName} />
              <InfoField label="Natureza jurídica" value={company.legalNature} />
              <InfoField label="Porte" value={company.companySize} />
              <InfoField label="Capital social" value={company.shareCapital ? formatCurrencyBRL(Number(company.shareCapital)) : null} />
              <InfoField label="Inscrição estadual" value={company.stateRegistration} />
              <InfoField label="Inscrição municipal" value={company.municipalRegistration} />
              <InfoField label="CNAE principal" value={company.mainCnae} />
              <InfoField label="Telefone" value={company.phone} />
              <InfoField label="E-mail" value={company.email} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="enderecos" className="flex flex-col gap-3">
          {company.addresses.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum endereço cadastrado.</p>
          )}
          {company.addresses.map((address) => (
            <Card key={address.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">
                    {address.street}
                    {address.number ? `, ${address.number}` : ""}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {address.district ? `${address.district} — ` : ""}
                    {address.city}/{address.state} — {address.postalCode}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{ADDRESS_TYPE_LABELS[address.addressType]}</Badge>
                  {address.isPrimary && <Badge>Principal</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="contatos" className="flex flex-col gap-3">
          {company.contacts.length === 0 && (
            <p className="text-sm text-muted-foreground">Nenhum contato cadastrado.</p>
          )}
          {company.contacts.map((contact) => (
            <Card key={contact.id}>
              <CardContent className="flex items-start justify-between gap-4 pt-6">
                <div>
                  <p className="font-medium">{contact.name}</p>
                  <p className="text-sm text-muted-foreground">
                    {[contact.position, contact.phone, contact.email].filter(Boolean).join(" · ")}
                  </p>
                </div>
                <div className="flex gap-2">
                  <Badge variant="outline">{CONTACT_TYPE_LABELS[contact.contactType]}</Badge>
                  {contact.isPrimary && <Badge>Principal</Badge>}
                </div>
              </CardContent>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="fiscal">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3">
              <InfoField label="Regime tributário" value={company.taxRegime ? TAX_REGIME_LABELS[company.taxRegime] : null} />
              <InfoField
                label="Regime de apuração"
                value={company.taxAssessmentMethod ? ACCOUNTING_CRITERION_LABELS[company.taxAssessmentMethod] : null}
              />
              <InfoField label="Contribuinte do ICMS" value={company.icmsTaxpayer ? "Sim" : "Não"} />
              <InfoField label="Optante pelo Simples Nacional" value={company.simplesNacionalOptant ? "Sim" : "Não"} />
              <InfoField label="Escritório contábil" value={company.accountingFirmName} />
              <InfoField label="Responsável contábil" value={company.accountingResponsibleName} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="financeiro">
          <Card>
            <CardContent className="grid grid-cols-2 gap-4 pt-6 sm:grid-cols-3">
              <InfoField label="Moeda" value={company.currencyCode} />
              <InfoField label="Fuso horário" value={company.timezone} />
              <InfoField label="Critério financeiro" value={ACCOUNTING_CRITERION_LABELS[company.financialMethod]} />
              <InfoField label="Dia de fechamento" value={company.monthClosingDay} />
              <InfoField label="Categoria obrigatória" value={company.requiresCategory ? "Sim" : "Não"} />
              <InfoField label="Centro de custo obrigatório" value={company.requiresCostCenter ? "Sim" : "Não"} />
              <InfoField label="Exige aprovação" value={company.requiresApproval ? `Sim (${company.approvalLevels} nível(is))` : "Não"} />
              <InfoField label="Numeração automática" value={company.automaticCodeEnabled ? "Ativada" : "Desativada"} />
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="usuarios">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Usuários vinculados</CardTitle>
            </CardHeader>
            <CardContent>
              {!memberships || memberships.items.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhum usuário vinculado.</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Nome</TableHead>
                      <TableHead>E-mail</TableHead>
                      <TableHead>Perfil</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {memberships.items.map((m) => (
                      <TableRow key={m.id}>
                        <TableCell>{m.user.name}</TableCell>
                        <TableCell>{m.user.email}</TableCell>
                        <TableCell>{m.role.name}</TableCell>
                        <TableCell>{m.status === "ACTIVE" ? "Ativo" : "Inativo"}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>
        </TabsContent>

        <TabsContent value="historico" className="flex flex-col gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Histórico de status</CardTitle>
            </CardHeader>
            <CardContent>
              {company.statusHistory.length === 0 ? (
                <p className="text-sm text-muted-foreground">Nenhuma alteração de status registrada.</p>
              ) : (
                <ul className="flex flex-col gap-2 text-sm">
                  {company.statusHistory.map((h) => (
                    <li key={h.id} className="flex flex-col border-b pb-2 last:border-0">
                      <span>
                        {h.previousStatus ? COMPANY_SYSTEM_STATUS_LABELS[h.previousStatus] : "—"} →{" "}
                        {COMPANY_SYSTEM_STATUS_LABELS[h.newStatus]}
                      </span>
                      <span className="text-xs text-muted-foreground">
                        {formatDateTimeBR(h.changedAt)}
                        {h.reason ? ` · ${h.reason}` : ""}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </CardContent>
          </Card>

          {canViewAudit && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Auditoria</CardTitle>
              </CardHeader>
              <CardContent>
                {!auditLog || auditLog.items.length === 0 ? (
                  <p className="text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</p>
                ) : (
                  <>
                    <ul className="flex flex-col gap-2 text-sm">
                      {auditLog.items.map((entry) => (
                        <li key={entry.id} className="border-b pb-2 last:border-0">
                          <span className="font-medium">{entry.action}</span>{" "}
                          <span className="text-muted-foreground">— {entry.entity}</span>
                          <p className="text-xs text-muted-foreground">{formatDateTimeBR(entry.createdAt)}</p>
                        </li>
                      ))}
                    </ul>
                    <div className="mt-3 flex gap-2">
                      <Button variant="outline" size="sm" disabled={auditPage <= 1} onClick={() => setAuditPage((p) => p - 1)}>
                        Anterior
                      </Button>
                      <Button
                        variant="outline"
                        size="sm"
                        disabled={auditPage >= auditLog.meta.totalPages}
                        onClick={() => setAuditPage((p) => p + 1)}
                      >
                        Próxima
                      </Button>
                    </div>
                  </>
                )}
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>
    </div>
  );
}

export default function CompanyDetailPage() {
  return (
    <Suspense fallback={null}>
      <CompanyDetailContent />
    </Suspense>
  );
}
