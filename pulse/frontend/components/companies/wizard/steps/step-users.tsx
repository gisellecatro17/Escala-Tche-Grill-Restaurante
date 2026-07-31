"use client";

import * as React from "react";
import { zodResolver } from "@hookform/resolvers/zod";
import { Loader2, Plus, Trash2, Users as UsersIcon } from "lucide-react";
import { useForm } from "react-hook-form";
import { z } from "zod";

import { useAddCompanyUser, useCompanyUsers, useRemoveCompanyUser } from "@/lib/api/companies";
import { useRoles } from "@/lib/api/roles";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";

const addUserSchema = z.object({
  name: z.string().min(2, "Informe o nome do usuário."),
  email: z.email("Informe um e-mail válido."),
  roleId: z.string().min(1, "Selecione o perfil."),
});

type AddUserValues = z.infer<typeof addUserSchema>;

interface StepUsersProps {
  companyId?: string;
  onRequestSaveDraft?: () => void;
  isSavingDraft?: boolean;
}

export function StepUsers({ companyId, onRequestSaveDraft, isSavingDraft }: StepUsersProps) {
  if (!companyId) {
    return (
      <Card>
        <CardContent className="flex flex-col items-center gap-4 py-10 text-center">
          <UsersIcon className="size-8 text-muted-foreground" />
          <div>
            <p className="font-medium">Vincule usuários depois de salvar o cadastro</p>
            <p className="text-sm text-muted-foreground">
              Salve esta empresa como rascunho para liberar a inclusão de usuários — o mesmo usuário
              pode estar vinculado a várias empresas, com perfis diferentes em cada uma.
            </p>
          </div>
          {onRequestSaveDraft && (
            <Button type="button" variant="outline" onClick={onRequestSaveDraft} disabled={isSavingDraft}>
              {isSavingDraft && <Loader2 className="animate-spin" />}
              Salvar como rascunho
            </Button>
          )}
        </CardContent>
      </Card>
    );
  }

  return <CompanyUsersManager companyId={companyId} />;
}

function CompanyUsersManager({ companyId }: { companyId: string }) {
  const { data: memberships, isLoading } = useCompanyUsers(companyId);
  const { data: roles } = useRoles();
  const addUser = useAddCompanyUser(companyId);
  const removeUser = useRemoveCompanyUser(companyId);

  const form = useForm<AddUserValues>({
    resolver: zodResolver(addUserSchema),
    defaultValues: { name: "", email: "", roleId: "" },
  });

  async function onSubmit(values: AddUserValues) {
    await addUser.mutateAsync(values);
    form.reset();
  }

  return (
    <div className="flex flex-col gap-6">
      <Card>
        <CardHeader>
          <CardTitle className="text-base">Usuários vinculados</CardTitle>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <p className="text-sm text-muted-foreground">Carregando...</p>
          ) : !memberships || memberships.items.length === 0 ? (
            <p className="text-sm text-muted-foreground">Nenhum usuário vinculado ainda.</p>
          ) : (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Nome</TableHead>
                  <TableHead>E-mail</TableHead>
                  <TableHead>Perfil</TableHead>
                  <TableHead>Status</TableHead>
                  <TableHead className="w-10" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {memberships.items.map((membership) => (
                  <TableRow key={membership.id}>
                    <TableCell>{membership.user.name}</TableCell>
                    <TableCell>{membership.user.email}</TableCell>
                    <TableCell>{membership.role.name}</TableCell>
                    <TableCell>{membership.status === "ACTIVE" ? "Ativo" : "Inativo"}</TableCell>
                    <TableCell>
                      <Button
                        type="button"
                        variant="ghost"
                        size="icon"
                        onClick={() => removeUser.mutate(membership.userId)}
                        disabled={removeUser.isPending}
                      >
                        <Trash2 className="text-destructive" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="text-base">+ Incluir novo usuário</CardTitle>
        </CardHeader>
        <CardContent>
          {addUser.isError && (
            <Alert variant="destructive" className="mb-4">
              <AlertTitle>Não foi possível incluir o usuário.</AlertTitle>
              <AlertDescription>{addUser.error.message}</AlertDescription>
            </Alert>
          )}
          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="grid grid-cols-1 gap-3 sm:grid-cols-3 sm:items-end">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Nome</FormLabel>
                    <FormControl>
                      <Input {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>E-mail</FormLabel>
                    <FormControl>
                      <Input type="email" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="roleId"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Perfil</FormLabel>
                    <Select value={field.value} onValueChange={field.onChange}>
                      <FormControl>
                        <SelectTrigger className="w-full">
                          <SelectValue placeholder="Selecione o perfil" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {roles?.map((role) => (
                          <SelectItem key={role.id} value={role.id}>
                            {role.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <Button type="submit" className="sm:col-span-3 sm:w-fit" disabled={form.formState.isSubmitting}>
                {form.formState.isSubmitting ? <Loader2 className="animate-spin" /> : <Plus />}
                Incluir novo usuário
              </Button>
            </form>
          </Form>
        </CardContent>
      </Card>
    </div>
  );
}
