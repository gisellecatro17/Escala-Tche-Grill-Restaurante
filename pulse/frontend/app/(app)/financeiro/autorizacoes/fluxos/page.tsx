"use client";

import * as React from "react";
import Link from "next/link";
import { AlertTriangle, ArrowLeft, GitBranch, Loader2, Plus, Trash2 } from "lucide-react";

import {
  useApprovalFlowActions,
  useApprovalFlows,
} from "@/lib/api/approvals";
import { useRoles } from "@/lib/api/roles";
import { useSession } from "@/lib/auth/session-context";
import { formatCurrencyBRL } from "@/lib/format";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { Field } from "@/components/treasury/field";
import {
  APPROVER_TYPE_LABELS,
  NOTIFICATION_CHANNEL_LABELS,
  UNIMPLEMENTED_CHANNELS,
  type ApprovalFlowStep,
} from "@/types/approvals";

interface DraftStep {
  stepOrder: number;
  name: string;
  approverRoleId: string;
  requiredApprovals: number;
  minimumAmount: string;
  maximumAmount: string;
}

/**
 * Fluxos e alçadas (seções 5, 6 e 7).
 *
 * A alçada mora nas etapas: "até R$ 1.000 → Supervisor" e "acima de R$ 100.000 → Diretor +
 * Sócio" são o mesmo fluxo com faixas diferentes. Uma tabela separada de alçadas criaria
 * duas fontes de verdade sobre quem aprova o quê.
 */
export default function FluxosPage() {
  const { user, selectedCompanyId, hasPermission } = useSession();
  const organizationId = user?.organizationMemberships[0]?.organizationId;
  const companyId = selectedCompanyId ?? undefined;

  const { data: flows, isLoading } = useApprovalFlows(companyId);
  const { data: roles } = useRoles();
  const actions = useApprovalFlowActions();

  const [creating, setCreating] = React.useState(false);
  const [name, setName] = React.useState("");
  const [priority, setPriority] = React.useState(100);
  const [steps, setSteps] = React.useState<DraftStep[]>([
    {
      stepOrder: 1,
      name: "Supervisor",
      approverRoleId: "",
      requiredApprovals: 1,
      minimumAmount: "",
      maximumAmount: "",
    },
  ]);
  const [failure, setFailure] = React.useState<string | null>(null);

  const canManage = hasPermission("approvals.manage");

  function submit() {
    if (!organizationId || !companyId) return;
    setFailure(null);

    actions.create.mutate(
      {
        organizationId,
        companyId,
        name,
        priority,
        steps: steps.map((step) => ({
          stepOrder: step.stepOrder,
          name: step.name,
          approverType: "ROLE",
          approverRoleId: step.approverRoleId,
          requiredApprovals: step.requiredApprovals,
          ...(step.minimumAmount
            ? { minimumAmount: Number(step.minimumAmount) }
            : {}),
          ...(step.maximumAmount
            ? { maximumAmount: Number(step.maximumAmount) }
            : {}),
        })),
      },
      {
        onSuccess: () => {
          setCreating(false);
          setName("");
          setSteps([
            {
              stepOrder: 1,
              name: "Supervisor",
              approverRoleId: "",
              requiredApprovals: 1,
              minimumAmount: "",
              maximumAmount: "",
            },
          ]);
        },
        onError: (caught: unknown) =>
          setFailure(
            caught instanceof Error
              ? caught.message
              : "Não foi possível criar o fluxo.",
          ),
      },
    );
  }

  return (
    <div className="flex flex-col gap-4 p-4">
      <div className="flex flex-wrap items-center gap-2">
        <Button variant="ghost" size="icon" asChild title="Voltar ao painel">
          <Link href="/financeiro/autorizacoes">
            <ArrowLeft className="size-4" />
          </Link>
        </Button>
        <div className="min-w-0 flex-1">
          <h1 className="flex items-center gap-2 text-lg font-semibold">
            <GitBranch className="size-5" />
            Fluxos e alçadas
          </h1>
          <p className="text-xs text-muted-foreground">
            O fluxo de maior prioridade cujos critérios batem com o lançamento vence. Empate
            resolve pelo mais específico.
          </p>
        </div>
        {canManage && !creating && (
          <Button onClick={() => setCreating(true)}>
            <Plus className="size-4" />
            Novo fluxo
          </Button>
        )}
      </div>

      {failure && (
        <Alert variant="destructive">
          <AlertTriangle />
          <AlertTitle>Fluxo não criado</AlertTitle>
          <AlertDescription>{failure}</AlertDescription>
        </Alert>
      )}

      {creating && (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base">Novo fluxo</CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col gap-3">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Nome" required>
                <Input
                  value={name}
                  placeholder="Compra de alimentos"
                  onChange={(event) => setName(event.target.value)}
                />
              </Field>
              <Field
                label="Prioridade"
                hint="Menor número vence quando dois fluxos casam."
              >
                <Input
                  type="number"
                  min={1}
                  value={priority}
                  onChange={(event) => setPriority(Number(event.target.value))}
                />
              </Field>
            </div>

            <p className="text-sm font-medium">Etapas e alçadas</p>
            {steps.map((step, index) => (
              <div
                key={index}
                className="grid gap-2 rounded-md border p-3 sm:grid-cols-5"
              >
                <Field label="Nome da etapa">
                  <Input
                    value={step.name}
                    onChange={(event) =>
                      setSteps((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, name: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Perfil aprovador">
                  <Select
                    value={step.approverRoleId}
                    onValueChange={(value) =>
                      setSteps((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, approverRoleId: value }
                            : item,
                        ),
                      )
                    }
                  >
                    <SelectTrigger className="w-full">
                      <SelectValue placeholder="Selecione" />
                    </SelectTrigger>
                    <SelectContent>
                      {(roles ?? []).map((role) => (
                        <SelectItem key={role.id} value={role.id}>
                          {role.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </Field>
                <Field label="Assinaturas" hint="2 = dupla aprovação">
                  <Input
                    type="number"
                    min={1}
                    value={step.requiredApprovals}
                    onChange={(event) =>
                      setSteps((current) =>
                        current.map((item, position) =>
                          position === index
                            ? {
                                ...item,
                                requiredApprovals: Number(event.target.value),
                              }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="A partir de (R$)">
                  <Input
                    inputMode="decimal"
                    value={step.minimumAmount}
                    onChange={(event) =>
                      setSteps((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, minimumAmount: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
                <Field label="Até (R$)">
                  <Input
                    inputMode="decimal"
                    value={step.maximumAmount}
                    onChange={(event) =>
                      setSteps((current) =>
                        current.map((item, position) =>
                          position === index
                            ? { ...item, maximumAmount: event.target.value }
                            : item,
                        ),
                      )
                    }
                  />
                </Field>
              </div>
            ))}

            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={() =>
                  setSteps((current) => [
                    ...current,
                    {
                      stepOrder: current.length + 1,
                      name: "",
                      approverRoleId: "",
                      requiredApprovals: 1,
                      minimumAmount: "",
                      maximumAmount: "",
                    },
                  ])
                }
              >
                <Plus className="size-4" />
                Adicionar etapa
              </Button>
              {steps.length > 1 && (
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setSteps((current) => current.slice(0, -1))}
                >
                  Remover última
                </Button>
              )}
            </div>

            <div className="flex gap-2 border-t pt-3">
              <Button
                disabled={!name.trim() || actions.create.isPending}
                onClick={submit}
              >
                {actions.create.isPending && (
                  <Loader2 className="size-4 animate-spin" />
                )}
                Criar fluxo
              </Button>
              <Button variant="ghost" onClick={() => setCreating(false)}>
                Cancelar
              </Button>
            </div>
          </CardContent>
        </Card>
      )}

      {isLoading ? (
        <Skeleton className="h-80 w-full" />
      ) : (flows ?? []).length === 0 ? (
        <Card>
          <CardContent className="py-10 text-center text-sm text-muted-foreground">
            Nenhum fluxo cadastrado. Sem fluxo, o lançamento segue direto — a menos que os
            parâmetros da empresa exijam aprovação.
          </CardContent>
        </Card>
      ) : (
        <div className="flex flex-col gap-3">
          {(flows ?? []).map((flow) => (
            <Card key={flow.id}>
              <CardHeader className="pb-3">
                <CardTitle className="flex flex-wrap items-center gap-2 text-base">
                  {flow.name}
                  <Badge variant="outline">prioridade {flow.priority}</Badge>
                  {flow.isDefault && <Badge variant="secondary">Padrão</Badge>}
                  {flow._count && (
                    <Badge variant="secondary">
                      {flow._count.requests} solicitação(ões)
                    </Badge>
                  )}
                  {canManage && (
                    <Button
                      variant="ghost"
                      size="icon"
                      className="ml-auto"
                      title="Excluir fluxo"
                      onClick={() => {
                        if (!window.confirm(`Excluir o fluxo "${flow.name}"?`)) return;
                        setFailure(null);
                        actions.remove.mutate(flow.id, {
                          onError: (caught: unknown) =>
                            setFailure(
                              caught instanceof Error
                                ? caught.message
                                : "Não foi possível excluir o fluxo.",
                            ),
                        });
                      }}
                    >
                      <Trash2 className="size-4" />
                    </Button>
                  )}
                </CardTitle>
                {flow.description && (
                  <p className="text-xs text-muted-foreground">{flow.description}</p>
                )}
              </CardHeader>
              <CardContent className="flex flex-col gap-2">
                <ol className="flex flex-col gap-1.5">
                  {(flow.steps ?? []).map((step) => (
                    <li
                      key={step.id}
                      className="flex flex-wrap items-center gap-2 rounded-md border px-3 py-2 text-sm"
                    >
                      <Badge variant="outline">{step.stepOrder}</Badge>
                      <span className="font-medium">{step.name}</span>
                      <span className="text-xs text-muted-foreground">
                        {APPROVER_TYPE_LABELS[step.approverType]}
                      </span>
                      {step.requiredApprovals > 1 && (
                        <Badge variant="secondary">
                          {step.requiredApprovals} assinaturas
                        </Badge>
                      )}
                      <span className="ml-auto text-xs text-muted-foreground">
                        {bandOf(step)}
                      </span>
                    </li>
                  ))}
                </ol>

                {flow.notificationChannels.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {flow.notificationChannels.map((channel) => (
                      <Badge
                        key={channel}
                        variant="outline"
                        className="text-muted-foreground"
                      >
                        {NOTIFICATION_CHANNEL_LABELS[channel]}
                        {UNIMPLEMENTED_CHANNELS.includes(channel) &&
                          " — não configurado"}
                      </Badge>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <Alert>
        <AlertTitle>Editar um fluxo não mexe no que já está em andamento</AlertTitle>
        <AlertDescription>
          As etapas da solicitação são cópias feitas na abertura. Quem aprovou aprovou sob as
          regras que valiam naquele momento.
        </AlertDescription>
      </Alert>
    </div>
  );
}

/** Faixa de valor da etapa, em texto — é a alçada que aquela etapa representa. */
function bandOf(step: ApprovalFlowStep): string {
  const minimum = step.minimumAmount === null ? null : Number(step.minimumAmount);
  const maximum = step.maximumAmount === null ? null : Number(step.maximumAmount);

  if (minimum === null && maximum === null) return "qualquer valor";
  if (minimum === null) return `até ${formatCurrencyBRL(maximum as number)}`;
  if (maximum === null) return `acima de ${formatCurrencyBRL(minimum)}`;

  return `${formatCurrencyBRL(minimum)} a ${formatCurrencyBRL(maximum)}`;
}
