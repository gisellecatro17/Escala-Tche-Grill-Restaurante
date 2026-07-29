"use client";

import * as React from "react";
import Link from "next/link";
import {
  Ban,
  Copy,
  Eye,
  History,
  Landmark,
  Pencil,
  PlayCircle,
  Search,
  Trash2,
  UserCog,
} from "lucide-react";

import {
  useActivateCompany,
  useDeactivateCompany,
  useDeleteCompany,
  useReactivateCompany,
  useSuspendCompany,
} from "@/lib/api/companies";
import { useSession } from "@/lib/auth/session-context";
import { ChangeStatusDialog } from "@/components/companies/change-status-dialog";
import { DuplicateSettingsDialog } from "@/components/companies/duplicate-settings-dialog";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import type { CompanySummary } from "@/types/company";

interface CompanyRowActionsProps {
  company: Pick<CompanySummary, "id" | "displayName" | "legalName" | "systemStatus" | "organizationId">;
  trigger?: React.ReactNode;
}

export function CompanyRowActions({ company, trigger }: CompanyRowActionsProps) {
  const { hasPermissionForCompany } = useSession();
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [suspendOpen, setSuspendOpen] = React.useState(false);
  const [duplicateOpen, setDuplicateOpen] = React.useState(false);

  const activate = useActivateCompany(company.id);
  const reactivate = useReactivateCompany(company.id);
  const deactivate = useDeactivateCompany(company.id);
  const suspend = useSuspendCompany(company.id);
  const remove = useDeleteCompany();

  const name = company.displayName ?? company.legalName ?? "empresa";

  return (
    <>
      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          {trigger ?? (
            <Button variant="ghost" size="sm">
              Ações
            </Button>
          )}
        </DropdownMenuTrigger>
        <DropdownMenuContent align="end" className="w-64">
          {hasPermissionForCompany(company.id, "company.view") && (
            <DropdownMenuItem asChild>
              <Link href={`/cadastros/empresas/${company.id}`}>
                <Eye /> Visualizar
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(company.id, "company.update") && (
            <DropdownMenuItem asChild>
              <Link href={`/cadastros/empresas/${company.id}/editar`}>
                <Pencil /> Editar
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(company.id, "company.query_document") && (
            <DropdownMenuItem asChild>
              <Link href={`/cadastros/empresas/${company.id}?tab=identificacao`}>
                <Search /> Consultar CNPJ
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(company.id, "company.manage_users") && (
            <DropdownMenuItem asChild>
              <Link href={`/cadastros/empresas/${company.id}?tab=usuarios`}>
                <UserCog /> Gerenciar usuários
              </Link>
            </DropdownMenuItem>
          )}
          <Tooltip>
            <TooltipTrigger asChild>
              <div>
                <DropdownMenuItem disabled>
                  <Landmark /> Gerenciar contas bancárias
                </DropdownMenuItem>
              </div>
            </TooltipTrigger>
            <TooltipContent>Disponível em uma próxima etapa</TooltipContent>
          </Tooltip>
          {hasPermissionForCompany(company.id, "company.duplicate_settings") && (
            <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}>
              <Copy /> Duplicar configurações
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(company.id, "company.view_audit") && (
            <DropdownMenuItem asChild>
              <Link href={`/cadastros/empresas/${company.id}?tab=historico`}>
                <History /> Consultar histórico
              </Link>
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {company.systemStatus !== "ACTIVE" && hasPermissionForCompany(company.id, "company.activate") && (
            <DropdownMenuItem
              onSelect={() => (company.systemStatus === "SUSPENDED" ? reactivate.mutate() : activate.mutate())}
            >
              <PlayCircle /> {company.systemStatus === "SUSPENDED" ? "Reativar empresa" : "Ativar empresa"}
            </DropdownMenuItem>
          )}
          {company.systemStatus !== "INACTIVE" && hasPermissionForCompany(company.id, "company.deactivate") && (
            <DropdownMenuItem onSelect={() => setDeactivateOpen(true)}>
              <Ban /> Inativar
            </DropdownMenuItem>
          )}
          {company.systemStatus !== "SUSPENDED" && hasPermissionForCompany(company.id, "company.suspend") && (
            <DropdownMenuItem onSelect={() => setSuspendOpen(true)}>
              <Ban /> Suspender
            </DropdownMenuItem>
          )}
          {company.systemStatus === "DRAFT" && hasPermissionForCompany(company.id, "company.delete") && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                if (window.confirm(`Excluir o rascunho "${name}"? Esta ação não pode ser desfeita.`)) {
                  remove.mutate(company.id);
                }
              }}
            >
              <Trash2 /> Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangeStatusDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deseja inativar esta empresa?"
        description="Os dados permanecerão armazenados, mas novos lançamentos não poderão ser incluídos."
        confirmLabel="Confirmar inativação"
        isSubmitting={deactivate.isPending}
        onConfirm={(reason) => deactivate.mutate(reason, { onSuccess: () => setDeactivateOpen(false) })}
      />

      <ChangeStatusDialog
        open={suspendOpen}
        onOpenChange={setSuspendOpen}
        title="Deseja suspender esta empresa?"
        description="A empresa permanece visível, mas novas operações financeiras ficam bloqueadas até a reativação."
        confirmLabel="Confirmar suspensão"
        isSubmitting={suspend.isPending}
        onConfirm={(reason) => suspend.mutate(reason, { onSuccess: () => setSuspendOpen(false) })}
      />

      <DuplicateSettingsDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        sourceCompanyId={company.id}
        organizationId={company.organizationId}
      />
    </>
  );
}
