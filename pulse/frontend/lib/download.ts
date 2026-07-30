/** Dispara o download de um blob já montado. */
function triggerDownload(blob: Blob, fileName: string) {
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  link.click();
  URL.revokeObjectURL(url);
}

/** Dispara o download de um conteúdo CSV gerado pelo back-end. */
export function downloadCsv(fileName: string, content: string) {
  // BOM garante que o Excel abra o arquivo com acentuação correta.
  triggerDownload(
    new Blob([`﻿${content}`], { type: "text/csv;charset=utf-8;" }),
    fileName,
  );
}

export function downloadJson(fileName: string, data: unknown) {
  triggerDownload(
    new Blob([JSON.stringify(data, null, 2)], { type: "application/json" }),
    fileName,
  );
}

/**
 * Dispara o download de um arquivo binário devolvido em base64 (XLSX e PDF). O back-end
 * envia base64 porque a resposta da API é sempre JSON.
 */
export function downloadBase64(
  fileName: string,
  base64: string,
  contentType: string,
) {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i += 1) {
    bytes[i] = binary.charCodeAt(i);
  }
  triggerDownload(new Blob([bytes], { type: contentType }), fileName);
}

/** Resposta de exportação da estrutura financeira, em qualquer dos quatro formatos. */
export interface ExportPayload {
  format: string;
  entity: string;
  fileName?: string;
  contentType?: string;
  content?: string;
  base64?: string;
  rows?: unknown[];
}

/** Escolhe a forma de download conforme o formato devolvido pelo back-end. */
export function downloadExport(payload: ExportPayload, fallbackName: string) {
  const name = payload.fileName ?? fallbackName;

  if (payload.base64) {
    downloadBase64(
      name,
      payload.base64,
      payload.contentType ?? "application/octet-stream",
    );
    return;
  }

  if (payload.format === "json") {
    downloadJson(`${name.replace(/\.\w+$/, "")}.json`, payload.rows ?? []);
    return;
  }

  if (payload.content) downloadCsv(name, payload.content);
}
