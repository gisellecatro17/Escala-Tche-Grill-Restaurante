/**
 * Mascaramento de dados bancários (seção 79 do prompt de fornecedores) — aplicado no
 * back-end sempre que o usuário autenticado não possuir a permissão de visualização
 * completa (`supplier.view_bank_data`).
 */
export function maskAccountFragment(
  value: string | null | undefined,
): string | null {
  if (!value) return value ?? null;
  const visible = value.slice(-1);
  return `${'*'.repeat(Math.max(value.length - 1, 0))}${visible}`;
}

export function maskPixKeyValue(
  value: string | null | undefined,
): string | null {
  if (!value) return value ?? null;

  if (value.includes('@')) {
    const [user, domain] = value.split('@');
    const visibleUser = user.slice(0, 2);
    return `${visibleUser}${'*'.repeat(Math.max(user.length - 2, 1))}@${domain}`;
  }

  if (/^\d+$/.test(value)) {
    const visible = value.slice(-4);
    return `${'*'.repeat(Math.max(value.length - 4, 0))}${visible}`;
  }

  return `${value.slice(0, 4)}${'*'.repeat(Math.max(value.length - 4, 0))}`;
}
