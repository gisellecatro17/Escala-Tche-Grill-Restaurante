"use client";

import * as React from "react";
import { Download } from "lucide-react";

import { useExportStructure } from "@/lib/api/financial-structure";
import { downloadExport } from "@/lib/download";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { ExportFormat, HierarchyEntity } from "@/types/financial-structure";

const FORMATS: { value: ExportFormat; label: string }[] = [
  { value: "xlsx", label: "Excel (.xlsx)" },
  { value: "csv", label: "CSV (.csv)" },
  { value: "json", label: "JSON (.json)" },
  { value: "pdf", label: "PDF (.pdf)" },
];

interface ExportMenuProps {
  organizationId: string | undefined;
  companyId?: string;
  entity: HierarchyEntity;
  /** Nome usado quando o back-end não sugere um. */
  fileBaseName: string;
  includeInactive?: boolean;
}

/** Botão de exportação nos quatro formatos da seção 45. */
export function ExportMenu({
  organizationId,
  companyId,
  entity,
  fileBaseName,
  includeInactive,
}: ExportMenuProps) {
  const exportStructure = useExportStructure();

  async function handleExport(format: ExportFormat) {
    if (!organizationId) return;
    const payload = await exportStructure.mutateAsync({
      organizationId,
      companyId,
      entity,
      format,
      includeInactive,
    });
    downloadExport(payload, `${fileBaseName}.${format}`);
  }

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="outline" disabled={exportStructure.isPending}>
          <Download /> Exportar
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuLabel>Formato do arquivo</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {FORMATS.map((format) => (
          <DropdownMenuItem
            key={format.value}
            onSelect={() => void handleExport(format.value)}
          >
            {format.label}
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
