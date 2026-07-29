/** Dispara o download de um conteúdo CSV gerado pelo back-end. */
export function downloadCsv(fileName: string, content: string) {
  // BOM garante que o Excel abra o arquivo com acentuação correta.
  const blob = new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}
