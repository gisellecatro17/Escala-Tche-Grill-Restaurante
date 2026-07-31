"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Copy, Eye, History, Landmark, PlayCircle, ShieldCheck, Trash2 } from "lucide-react";

import {
  useActivateSupplierLink,
  useBlockSupplierLink,
  useDeactivateSupplierLink,
  useDeleteSupplierLink,
  useUnblockSupplierLink,
} from "@/lib/api/suppliers";
import { useSession } from "@/lib/auth/session-context";
import { ChangeStatusDialog } from "@/components/companies/change-status-dialog";
import { DuplicateLinkDialog } from "@/components/suppliers/duplicate-link-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { SupplierLinkListItem } from "@/types/supplier";

interface SupplierRowActionsProps {
  link: SupplierLinkListItem;
  organizationId: string;
  trigger?: React.ReactNode;
}

export function SupplierRowActions({ link, organizationId, trigger }: SupplierRowActionsProps) {
  const { hasPermissionForCompany } = useSession();
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [duplicateOpen, setDuplicateOpen] = React.useState(false);

  const activate = useActivateSupplierLink(link.id);
  const unblock = useUnblockSupplierLink(link.id);
  const block = useBlockSupplierLink(link.id);
  const deactivate = useDeactivateSupplierLink(link.id);
  const remove = useDeleteSupplierLink();

  const name = link.supplier.displayName ?? link.supplier.legalName ?? "fornecedor";
  const base = `/cadastros/fornecedores/${link.supplierId}`;

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
          {hasPermissionForCompany(link.companyId, "supplier.view") && (
            <DropdownMenuItem asChild>
              <Link href={base}>
                <Eye /> Visualizar
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(link.companyId, "supplier.manage_classification") && (
            <DropdownMenuItem asChild>
              <Link href={`${base}/empresas/${link.id}`}>
                <ShieldCheck /> Editar vínculo com a empresa
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(link.companyId, "supplier.manage_bank_data") && (
            <DropdownMenuItem asChild>
              <Link href={`${base}?tab=bancario`}>
                <Landmark /> Dados bancários
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(link.companyId, "supplier.view_audit") && (
            <DropdownMenuItem asChild>
              <Link href={`${base}/empresas/${link.id}?tab=historico`}>
                <History /> Histórico
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(link.companyId, "supplier.duplicate_link") && (
            <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}>
              <Copy /> Duplicar vínculo
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {link.status !== "ACTIVE" && hasPermissionForCompany(link.companyId, "supplier.activate") && (
            <DropdownMenuItem onSelect={() => activate.mutate()}>
              <PlayCircle /> Ativar
            </DropdownMenuItem>
          )}
          {link.status === "BLOCKED" && hasPermissionForCompany(link.companyId, "supplier.unblock") && (
            <DropdownMenuItem onSelect={() => unblock.mutate()}>
              <PlayCircle /> Desbloquear
            </DropdownMenuItem>
          )}
          {link.status !== "BLOCKED" && hasPermissionForCompany(link.companyId, "supplier.block") && (
            <DropdownMenuItem onSelect={() => setBlockOpen(true)}>
              <Ban /> Bloquear
            </DropdownMenuItem>
          )}
          {link.status !== "INACTIVE" && hasPermissionForCompany(link.companyId, "supplier.deactivate") && (
            <DropdownMenuItem onSelect={() => setDeactivateOpen(true)}>
              <Ban /> Inativar
            </DropdownMenuItem>
          )}
          {link.status === "DRAFT" && hasPermissionForCompany(link.companyId, "supplier.delete") && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                if (window.confirm(`Excluir o vínculo do rascunho "${name}"? Esta ação não pode ser desfeita.`)) {
                  remove.mutate(link.id);
                }
              }}
            >
              <Trash2 /> Excluir
            </DropdownMenuItem>
          )}
        </DropdownMenuContent>
      </DropdownMenu>

      <ChangeStatusDialog
        open={blockOpen}
        onOpenChange={setBlockOpen}
        title="Deseja bloquear este fornecedor para a empresa selecionada?"
        description="O fornecedor permanece visível e mantém o histórico, mas não poderá ser utilizado em novos lançamentos até ser desbloqueado."
        confirmLabel="Confirmar bloqueio"
        isSubmitting={block.isPending}
        onConfirm={(reason) => block.mutate(reason, { onSuccess: () => setBlockOpen(false) })}
      />

      <ChangeStatusDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deseja inativar este vínculo?"
        description="O histórico, os documentos e as movimentações são preservados; apenas novos lançamentos ficam bloqueados."
        confirmLabel="Confirmar inativação"
        isSubmitting={deactivate.isPending}
        onConfirm={(reason) => deactivate.mutate(reason, { onSuccess: () => setDeactivateOpen(false) })}
      />

      <DuplicateLinkDialog
        open={duplicateOpen}
        onOpenChange={setDuplicateOpen}
        linkId={link.id}
        organizationId={organizationId}
        currentCompanyId={link.companyId}
      />
    </>
  );
}
