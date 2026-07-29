/** Remove tudo que não é dígito (usado para normalizar CPF/CNPJ/CEP/telefone antes de comparar ou persistir). */
export function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}
