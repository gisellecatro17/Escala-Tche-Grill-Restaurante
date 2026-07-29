"use client";

import * as React from "react";
import Link from "next/link";
import { Ban, Copy, Eye, History, PlayCircle, ShieldCheck, Trash2 } from "lucide-react";

import {
  useActivateCustomerLink,
  useBlockCustomerLink,
  useDeactivateCustomerLink,
  useDeleteCustomerLink,
  useUnblockCustomerLink,
} from "@/lib/api/customers";
import { useSession } from "@/lib/auth/session-context";
import { ChangeStatusDialog } from "@/components/companies/change-status-dialog";
import { DuplicateLinkDialog } from "@/components/customers/duplicate-link-dialog";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { CustomerLinkListItem } from "@/types/customer";

interface CustomerRowActionsProps {
  link: CustomerLinkListItem;
  organizationId: string;
  trigger?: React.ReactNode;
}

export function CustomerRowActions({ link, organizationId, trigger }: CustomerRowActionsProps) {
  const { hasPermissionForCompany } = useSession();
  const [blockOpen, setBlockOpen] = React.useState(false);
  const [deactivateOpen, setDeactivateOpen] = React.useState(false);
  const [duplicateOpen, setDuplicateOpen] = React.useState(false);

  const activate = useActivateCustomerLink(link.id);
  const unblock = useUnblockCustomerLink(link.id);
  const block = useBlockCustomerLink(link.id);
  const deactivate = useDeactivateCustomerLink(link.id);
  const remove = useDeleteCustomerLink();

  const name = link.customer.displayName ?? link.customer.legalName ?? "cliente";
  const base = `/cadastros/clientes/${link.customerId}`;

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
          {hasPermissionForCompany(link.companyId, "customer.view") && (
            <DropdownMenuItem asChild>
              <Link href={base}>
                <Eye /> Visualizar
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(link.companyId, "customer.manage_classification") && (
            <DropdownMenuItem asChild>
              <Link href={`${base}/empresas/${link.id}`}>
                <ShieldCheck /> Editar vínculo com a empresa
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(link.companyId, "customer.view_audit") && (
            <DropdownMenuItem asChild>
              <Link href={`${base}/empresas/${link.id}?tab=historico`}>
                <History /> Histórico
              </Link>
            </DropdownMenuItem>
          )}
          {hasPermissionForCompany(link.companyId, "customer.duplicate_link") && (
            <DropdownMenuItem onSelect={() => setDuplicateOpen(true)}>
              <Copy /> Duplicar vínculo
            </DropdownMenuItem>
          )}

          <DropdownMenuSeparator />

          {link.status === "PROSPECT" && hasPermissionForCompany(link.companyId, "customer.convert_prospect") && (
            <DropdownMenuItem asChild>
              <Link href={`${base}/empresas/${link.id}`}>
                <PlayCircle /> Converter em cliente
              </Link>
            </DropdownMenuItem>
          )}
          {link.status !== "ACTIVE" && link.status !== "PROSPECT" && hasPermissionForCompany(link.companyId, "customer.activate") && (
            <DropdownMenuItem onSelect={() => activate.mutate()}>
              <PlayCircle /> Ativar
            </DropdownMenuItem>
          )}
          {link.status === "BLOCKED" && hasPermissionForCompany(link.companyId, "customer.unblock") && (
            <DropdownMenuItem onSelect={() => unblock.mutate()}>
              <PlayCircle /> Desbloquear
            </DropdownMenuItem>
          )}
          {link.status !== "BLOCKED" && hasPermissionForCompany(link.companyId, "customer.block") && (
            <DropdownMenuItem onSelect={() => setBlockOpen(true)}>
              <Ban /> Bloquear
            </DropdownMenuItem>
          )}
          {link.status !== "INACTIVE" && hasPermissionForCompany(link.companyId, "customer.deactivate") && (
            <DropdownMenuItem onSelect={() => setDeactivateOpen(true)}>
              <Ban /> Inativar
            </DropdownMenuItem>
          )}
          {(link.status === "DRAFT" || link.status === "PROSPECT") && hasPermissionForCompany(link.companyId, "customer.delete") && (
            <DropdownMenuItem
              variant="destructive"
              onSelect={() => {
                if (window.confirm(`Excluir o vínculo de "${name}"? Esta ação não pode ser desfeita.`)) {
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
        title="Deseja bloquear este cliente para a empresa selecionada?"
        description="O cliente permanece visível e mantém o histórico, mas novos contratos e lançamentos ficam impedidos até ser desbloqueado."
        confirmLabel="Confirmar bloqueio"
        isSubmitting={block.isPending}
        onConfirm={(reason) => block.mutate(reason, { onSuccess: () => setBlockOpen(false) })}
      />

      <ChangeStatusDialog
        open={deactivateOpen}
        onOpenChange={setDeactivateOpen}
        title="Deseja inativar este vínculo?"
        description="O histórico, os contratos e as promessas de pagamento são preservados; apenas novos lançamentos ficam bloqueados."
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
