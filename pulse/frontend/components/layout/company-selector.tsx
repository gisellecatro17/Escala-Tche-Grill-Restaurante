"use client";

import { Building2, Check, ChevronsUpDown } from "lucide-react";

import { useSession } from "@/lib/auth/session-context";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

export function CompanySelector() {
  const { user, currentMembership, selectedCompanyId, selectCompany } = useSession();

  if (!user || user.memberships.length === 0) {
    return null;
  }

  if (user.memberships.length === 1) {
    return (
      <div className="flex items-center gap-2 rounded-md border bg-muted/40 px-3 py-1.5 text-sm">
        <Building2 className="size-4 text-muted-foreground" />
        <span className="max-w-40 truncate font-medium sm:max-w-56">
          {currentMembership?.companyName ?? user.memberships[0].companyName}
        </span>
      </div>
    );
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" className="gap-2 px-3">
          <Building2 className="size-4 text-muted-foreground" />
          <span className="max-w-40 truncate sm:max-w-56">
            {currentMembership?.companyName ?? "Selecione a empresa"}
          </span>
          <ChevronsUpDown className="size-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="w-72">
        <DropdownMenuLabel>Empresas disponíveis</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {user.memberships.map((membership) => (
          <DropdownMenuItem
            key={membership.companyId}
            onSelect={() => selectCompany(membership.companyId)}
            className="flex items-center justify-between gap-2"
          >
            <div className="flex flex-col overflow-hidden">
              <span className="truncate font-medium">{membership.companyName}</span>
              <span className="truncate text-xs text-muted-foreground">
                {membership.organizationName} · {membership.role.name}
              </span>
            </div>
            <Check
              className={cn(
                "size-4 shrink-0",
                membership.companyId === selectedCompanyId ? "opacity-100" : "opacity-0",
              )}
            />
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
