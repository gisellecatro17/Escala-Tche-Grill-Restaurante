/** Formata um valor numérico como moeda brasileira (R$ 1.234,56). */
export function formatCurrencyBRL(value: number): string {
  return new Intl.NumberFormat("pt-BR", {
    style: "currency",
    currency: "BRL",
  }).format(value);
}

/** Formata uma data ISO (ou Date) no padrão brasileiro DD/MM/AAAA. */
export function formatDateBR(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Bahia" }).format(date);
}

/** Formata data e hora no padrão brasileiro DD/MM/AAAA HH:mm. */
export function formatDateTimeBR(value: string | Date): string {
  const date = typeof value === "string" ? new Date(value) : value;
  return new Intl.DateTimeFormat("pt-BR", {
    timeZone: "America/Bahia",
    dateStyle: "short",
    timeStyle: "short",
  }).format(date);
}

/** Formata CNPJ (14 dígitos) ou CPF (11 dígitos) a partir de uma string numérica. */
export function formatDocument(document: string): string {
  const digits = document.replace(/\D/g, "");

  if (digits.length === 11) {
    return digits.replace(/(\d{3})(\d{3})(\d{3})(\d{2})/, "$1.$2.$3-$4");
  }

  if (digits.length === 14) {
    return digits.replace(/(\d{2})(\d{3})(\d{3})(\d{4})(\d{2})/, "$1.$2.$3/$4-$5");
  }

  return document;
}

/** Aplica a máscara de CNPJ (00.000.000/0000-00) enquanto o usuário digita. */
export function maskCnpj(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 14)
    .replace(/(\d{2})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1/$2")
    .replace(/(\d{4})(\d{1,2})$/, "$1-$2");
}

/** Aplica a máscara de CPF (000.000.000-00) enquanto o usuário digita. */
export function maskCpf(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 11)
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d)/, "$1.$2")
    .replace(/(\d{3})(\d{1,2})$/, "$1-$2");
}

/** Aplica a máscara de CPF ou CNPJ conforme a quantidade de dígitos já informada. */
export function maskCpfCnpj(value: string): string {
  const digits = value.replace(/\D/g, "");
  return digits.length > 11 ? maskCnpj(value) : maskCpf(value);
}

/** Aplica a máscara de CEP (00000-000) enquanto o usuário digita. */
export function maskCep(value: string): string {
  return value
    .replace(/\D/g, "")
    .slice(0, 8)
    .replace(/(\d{5})(\d)/, "$1-$2");
}

/** Aplica a máscara de telefone brasileiro — (00) 0000-0000 ou (00) 00000-0000. */
export function maskPhone(value: string): string {
  const digits = value.replace(/\D/g, "").slice(0, 11);

  if (digits.length <= 10) {
    return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{4})(\d{1,4})$/, "$1-$2");
  }

  return digits.replace(/(\d{2})(\d)/, "($1) $2").replace(/(\d{5})(\d{1,4})$/, "$1-$2");
}
