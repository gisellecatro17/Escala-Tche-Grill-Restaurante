"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Loader2 } from "lucide-react";

import {
  useAddAllocation,
  useAddContract,
  useAddTaxWithholding,
  useSupplierLink,
  useSupplierLinkAuditLog,
  useUpdateSupplierLink,
} from "@/lib/api/suppliers";
import { CategorySelect } from "@/components/suppliers/category-select";
import { CostCenterSelect } from "@/components/suppliers/cost-center-select";
import { SupplierLinkStatusBadge } from "@/components/suppliers/supplier-link-status-badge";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { formatDateTimeBR } from "@/lib/format";
import { FINANCIAL_NATURE_LABELS, PAYMENT_METHOD_LABELS, TAX_WITHHOLDING_TYPE_LABELS } from "@/types/supplier";

function ClassificationTab({ linkId, companyId }: { linkId: string; companyId: string }) {
  const { data: link } = useSupplierLink(linkId);
  if (!link) return null;
  // A `key` no id do vínculo faz o React remontar o formulário (reiniciando o estado local
  // a partir dos dados carregados) sempre que o vínculo mudar, sem precisar de um efeito.
  return <ClassificationForm key={link.id} linkId={linkId} companyId={companyId} link={link} />;
}

function ClassificationForm({
  linkId,
  companyId,
  link,
}: {
  linkId: string;
  companyId: string;
  link: { defaultCategoryId?: string | null; defaultCostCenterId?: string | null };
}) {
  const update = useUpdateSupplierLink(linkId);
  const [categoryId, setCategoryId] = React.useState<string | undefined>(link.defaultCategoryId ?? undefined);
  const [costCenterId, setCostCenterId] = React.useState<string | undefined>(link.defaultCostCenterId ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Classificação financeira</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <CategorySelect companyId={companyId} value={categoryId} onChange={setCategoryId} label="Categoria financeira padrão" />
        <CostCenterSelect companyId={companyId} value={costCenterId} onChange={setCostCenterId} />
        <div className="sm:col-span-2">
          <Button
            onClick={() => update.mutate({ defaultCategoryId: categoryId, defaultCostCenterId: costCenterId })}
            disabled={update.isPending}
          >
            {update.isPending && <Loader2 className="animate-spin" />}
            Salvar classificação
          </Button>
          {update.isSuccess && <p className="mt-2 text-sm text-success">Classificação financeira atualizada com sucesso.</p>}
        </div>
      </CardContent>
    </Card>
  );
}

function CommercialTab({ linkId }: { linkId: string }) {
  const { data: link } = useSupplierLink(linkId);
  if (!link) return null;
  return <CommercialForm key={link.id} linkId={linkId} link={link} />;
}

function CommercialForm({
  linkId,
  link,
}: {
  linkId: string;
  link: { preferredPaymentMethod?: string | null; financialNature?: string | null };
}) {
  const update = useUpdateSupplierLink(linkId);
  const [preferredPaymentMethod, setPreferredPaymentMethod] = React.useState(link.preferredPaymentMethod ?? undefined);
  const [financialNature, setFinancialNature] = React.useState(link.financialNature ?? undefined);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Condições comerciais</CardTitle>
      </CardHeader>
      <CardContent className="grid grid-cols-1 gap-4 sm:grid-cols-2">
        <div className="flex flex-col gap-1.5">
          <Label>Forma de pagamento preferencial</Label>
          <Select value={preferredPaymentMethod} onValueChange={(v) => setPreferredPaymentMethod(v as never)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(PAYMENT_METHOD_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="flex flex-col gap-1.5">
          <Label>Natureza financeira</Label>
          <Select value={financialNature} onValueChange={(v) => setFinancialNature(v as never)}>
            <SelectTrigger className="w-full">
              <SelectValue placeholder="Selecione" />
            </SelectTrigger>
            <SelectContent>
              {Object.entries(FINANCIAL_NATURE_LABELS).map(([value, label]) => (
                <SelectItem key={value} value={value}>
                  {label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className="sm:col-span-2">
          <Button onClick={() => update.mutate({ preferredPaymentMethod, financialNature })} disabled={update.isPending}>
            {update.isPending && <Loader2 className="animate-spin" />}
            Salvar condições comerciais
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function AutomationTab({ linkId }: { linkId: string }) {
  const { data: link } = useSupplierLink(linkId);
  const update = useUpdateSupplierLink(linkId);

  if (!link) return null;

  const toggles: { key: keyof typeof link; label: string }[] = [
    { key: "autoIdentificationEnabled", label: "Identificar fornecedor na importação bancária" },
    { key: "autoClassificationEnabled", label: "Aplicar categoria automaticamente" },
    { key: "autoCostCenterEnabled", label: "Aplicar centro de custo automaticamente" },
    { key: "autoAllocationEnabled", label: "Aplicar rateio automaticamente" },
    { key: "reconciliationSuggestionEnabled", label: "Sugerir conciliação" },
    { key: "autoEntryCreationEnabled", label: "Criar despesa automaticamente" },
    { key: "autoReconciliationEnabled", label: "Conciliar automaticamente" },
  ];

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Regras automáticas</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {toggles.map(({ key, label }) => (
          <label key={key} className="flex items-center justify-between gap-4 rounded-md border p-3 text-sm">
            {label}
            <Switch checked={Boolean(link[key])} onCheckedChange={(checked) => update.mutate({ [key]: checked })} />
          </label>
        ))}
        <div className="flex items-center gap-2">
          <Label>Limite mínimo de confiança (%)</Label>
          <Input
            type="number"
            min={0}
            max={100}
            className="w-24"
            defaultValue={link.confirmationThreshold}
            onBlur={(e) => update.mutate({ confirmationThreshold: Number(e.target.value) })}
          />
        </div>
      </CardContent>
    </Card>
  );
}

function AllocationsWithholdingsTab({ linkId, companyId }: { linkId: string; companyId: string }) {
  const { data: link } = useSupplierLink(linkId);
  const addAllocation = useAddAllocation(linkId);
  const addWithholding = useAddTaxWithholding(linkId);
  const [newPercentage, setNewPercentage] = React.useState<number | undefined>();
  const [newCategoryId, setNewCategoryId] = React.useState<string | undefined>();
  const [newTaxType, setNewTaxType] = React.useState<string>("IRRF");
  const [newRate, setNewRate] = React.useState<number | undefined>();

  const total = (link?.allocations ?? [])
    .filter((a) => a.allocationType === "PERCENTAGE")
    .reduce((sum, a) => sum + (a.percentage ?? 0), 0);

  return (
    <div className="flex flex-col gap-4">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Rateios</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(link?.allocations ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum rateio cadastrado.</p>}
          <ul className="flex flex-col gap-1 text-sm">
            {(link?.allocations ?? []).map((a) => (
              <li key={a.id}>
                {a.allocationType === "PERCENTAGE" ? `${a.percentage}%` : a.fixedAmount} — categoria/centro de custo configurado
              </li>
            ))}
          </ul>
          {total > 100 && <Alert variant="destructive"><AlertDescription>A soma dos rateios ultrapassa 100%.</AlertDescription></Alert>}
          <div className="flex flex-wrap items-end gap-2">
            <CategorySelect companyId={companyId} value={newCategoryId} onChange={setNewCategoryId} label="Categoria" />
            <div className="flex flex-col gap-1.5">
              <Label>Percentual (%)</Label>
              <Input type="number" min={0} max={100} value={newPercentage ?? ""} onChange={(e) => setNewPercentage(e.target.value ? Number(e.target.value) : undefined)} className="w-32" />
            </div>
            <Button
              onClick={() => {
                addAllocation.mutate({ allocationType: "PERCENTAGE", percentage: newPercentage, categoryId: newCategoryId });
                setNewPercentage(undefined);
                setNewCategoryId(undefined);
              }}
              disabled={addAllocation.isPending}
            >
              <Plus /> Incluir novo item de rateio
            </Button>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">Retenções tributárias</CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {(link?.taxWithholdings ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhuma retenção cadastrada.</p>}
          <ul className="flex flex-col gap-1 text-sm">
            {(link?.taxWithholdings ?? []).map((w) => (
              <li key={w.id}>
                {TAX_WITHHOLDING_TYPE_LABELS[w.taxType]} — {w.rate ?? 0}%
              </li>
            ))}
          </ul>
          <div className="flex flex-wrap items-end gap-2">
            <div className="flex flex-col gap-1.5">
              <Label>Tipo</Label>
              <Select value={newTaxType} onValueChange={setNewTaxType}>
                <SelectTrigger className="w-40">
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {Object.entries(TAX_WITHHOLDING_TYPE_LABELS).map(([value, label]) => (
                    <SelectItem key={value} value={value}>
                      {label}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            <div className="flex flex-col gap-1.5">
              <Label>Alíquota (%)</Label>
              <Input type="number" min={0} max={100} value={newRate ?? ""} onChange={(e) => setNewRate(e.target.value ? Number(e.target.value) : undefined)} className="w-32" />
            </div>
            <Button
              onClick={() => {
                addWithholding.mutate({ taxType: newTaxType, rate: newRate });
                setNewRate(undefined);
              }}
              disabled={addWithholding.isPending}
            >
              <Plus /> Incluir nova retenção
            </Button>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}

function Plus() {
  return <span className="mr-1">+</span>;
}

function ContractsTab({ linkId }: { linkId: string }) {
  const { data: link } = useSupplierLink(linkId);
  const addContract = useAddContract(linkId);
  const [description, setDescription] = React.useState("");

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Contratos</CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {(link?.contracts ?? []).length === 0 && <p className="text-sm text-muted-foreground">Nenhum contrato cadastrado.</p>}
        <ul className="flex flex-col gap-1 text-sm">
          {(link?.contracts ?? []).map((c) => (
            <li key={c.id}>
              {c.contractNumber ?? "Sem número"} — {c.description ?? "Sem descrição"}
            </li>
          ))}
        </ul>
        <div className="flex items-end gap-2">
          <div className="flex flex-1 flex-col gap-1.5">
            <Label>Descrição do novo contrato</Label>
            <Input value={description} onChange={(e) => setDescription(e.target.value)} />
          </div>
          <Button
            onClick={() => {
              addContract.mutate({ description });
              setDescription("");
            }}
            disabled={!description.trim() || addContract.isPending}
          >
            Incluir novo contrato
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

function HistoryTab({ linkId }: { linkId: string }) {
  const [page, setPage] = React.useState(1);
  const { data: auditLog } = useSupplierLinkAuditLog(linkId, page);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-base">Histórico e auditoria</CardTitle>
      </CardHeader>
      <CardContent>
        {!auditLog || auditLog.items.length === 0 ? (
          <p className="text-sm text-muted-foreground">Nenhum registro de auditoria ainda.</p>
        ) : (
          <>
            <ul className="flex flex-col gap-2 text-sm">
              {auditLog.items.map((entry) => (
                <li key={entry.id} className="border-b pb-2 last:border-0">
                  <span className="font-medium">{entry.action}</span> <span className="text-muted-foreground">— {entry.entity}</span>
                  <p className="text-xs text-muted-foreground">{formatDateTimeBR(entry.createdAt)}</p>
                </li>
              ))}
            </ul>
            <div className="mt-3 flex gap-2">
              <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage((p) => p - 1)}>
                Anterior
              </Button>
              <Button variant="outline" size="sm" disabled={page >= auditLog.meta.totalPages} onClick={() => setPage((p) => p + 1)}>
                Próxima
              </Button>
            </div>
          </>
        )}
      </CardContent>
    </Card>
  );
}

export default function SupplierCompanyLinkPage() {
  const params = useParams<{ id: string; companyLinkId: string }>();
  const { data: link, isLoading } = useSupplierLink(params.companyLinkId);

  if (isLoading) {
    return (
      <div className="mx-auto flex max-w-4xl flex-col gap-4">
        <Skeleton className="h-10 w-64" />
        <Skeleton className="h-40 w-full" />
      </div>
    );
  }

  if (!link) return null;

  return (
    <div className="mx-auto flex max-w-4xl flex-col gap-6">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold tracking-tight">Vínculo com {link.company?.displayName ?? link.company?.legalName}</h1>
          <p className="text-sm text-muted-foreground">Configurações específicas deste fornecedor para esta empresa.</p>
        </div>
        <SupplierLinkStatusBadge status={link.status} />
      </div>

      {link.status === "BLOCKED" && (
        <Alert variant="destructive">
          <AlertDescription>Fornecedor bloqueado{link.blockReason ? `: ${link.blockReason}` : "."}</AlertDescription>
        </Alert>
      )}

      <Tabs defaultValue="classificacao">
        <TabsList className="flex-wrap">
          <TabsTrigger value="classificacao">Classificação</TabsTrigger>
          <TabsTrigger value="comercial">Condições comerciais</TabsTrigger>
          <TabsTrigger value="retencoes-rateios">Retenções e rateios</TabsTrigger>
          <TabsTrigger value="automacao">Regras automáticas</TabsTrigger>
          <TabsTrigger value="contratos">Contratos</TabsTrigger>
          <TabsTrigger value="historico">Histórico</TabsTrigger>
        </TabsList>
        <TabsContent value="classificacao">
          <ClassificationTab linkId={link.id} companyId={link.companyId} />
        </TabsContent>
        <TabsContent value="comercial">
          <CommercialTab linkId={link.id} />
        </TabsContent>
        <TabsContent value="retencoes-rateios">
          <AllocationsWithholdingsTab linkId={link.id} companyId={link.companyId} />
        </TabsContent>
        <TabsContent value="automacao">
          <AutomationTab linkId={link.id} />
        </TabsContent>
        <TabsContent value="contratos">
          <ContractsTab linkId={link.id} />
        </TabsContent>
        <TabsContent value="historico">
          <HistoryTab linkId={link.id} />
        </TabsContent>
      </Tabs>
    </div>
  );
}
