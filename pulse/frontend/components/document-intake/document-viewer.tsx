"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import {
  Download,
  FileSpreadsheet,
  FileText,
  History,
  Loader2,
  Maximize2,
  Minimize2,
  RotateCw,
  ZoomIn,
  ZoomOut,
} from "lucide-react";

import {
  requestDocumentDownloadUrl,
  useDocumentAccessUrl,
} from "@/lib/api/document-intake";
import { useSession } from "@/lib/auth/session-context";
import { formatDateTimeBR } from "@/lib/format";
import { cn } from "@/lib/utils";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { formatBytes } from "@/components/document-intake/upload-dropzone";
import type { IntakeDocument, IntakeDocumentFile } from "@/types/document-intake";

/** Formas de exibição suportadas (seção 35). */
type ViewerKind = "PDF" | "IMAGE" | "XML" | "TEXT" | "SPREADSHEET" | "UNKNOWN";

const ZOOM_STEP = 0.25;
const ZOOM_MINIMUM = 0.5;
const ZOOM_MAXIMUM = 3;

/** Acima disso o XML não é exibido inteiro — só o começo, com aviso. */
const XML_PREVIEW_CHARACTER_LIMIT = 200_000;

/**
 * Visualizador do documento (seção 35).
 *
 * O arquivo **nunca** é servido pela aplicação: o que chega aqui é uma URL assinada e
 * temporária emitida pelo back-end, que registra a visualização na auditoria antes de
 * devolvê-la. Por isso o componente não guarda a URL em lugar nenhum além do cache curto
 * do React Query — quando ela expira, a próxima renderização pede outra.
 *
 * O PDF é renderizado pelo visualizador nativo do navegador, sem biblioteca externa:
 * páginas e zoom são passados no fragmento da URL (`#page=`, `#zoom=`), que os
 * visualizadores embutidos honram. A rotação é aplicada por CSS, porque é a única que o
 * fragmento não cobre — e nenhuma delas toca no arquivo original (seção 40).
 */
export function DocumentViewer({
  documentId,
  document,
}: {
  documentId: string;
  document: IntakeDocument;
}) {
  const { hasPermission } = useSession();
  const containerRef = React.useRef<HTMLDivElement>(null);

  const [zoom, setZoom] = React.useState(1);
  const [rotation, setRotation] = React.useState(0);
  const [page, setPage] = React.useState(1);
  const [fullScreen, setFullScreen] = React.useState(false);
  const [showVersions, setShowVersions] = React.useState(false);
  const [downloading, setDownloading] = React.useState(false);
  const [downloadError, setDownloadError] = React.useState<string | null>(null);

  const kind = viewerKindOf(document);
  const pageCount = document.pageCount ?? 1;
  const canDownload = hasPermission("document_intake.download");

  const access = useDocumentAccessUrl(documentId, "VIEW", Boolean(document.fileHash));
  const signedUrl = access.data?.url ?? null;

  // XML e texto são lidos no navegador para serem formatados. A URL assinada entra na
  // chave para que uma URL renovada não devolva o corpo antigo do cache.
  const inline = useQuery({
    queryKey: ["document-intake", "inline-preview", documentId, signedUrl],
    queryFn: async () => {
      const response = await fetch(signedUrl as string);
      if (!response.ok) {
        throw new Error("Não foi possível ler o conteúdo do arquivo.");
      }
      return response.text();
    },
    enabled: Boolean(signedUrl) && (kind === "XML" || kind === "TEXT"),
    staleTime: 120_000,
    retry: false,
  });

  React.useEffect(() => {
    function syncFullScreen() {
      setFullScreen(window.document.fullscreenElement === containerRef.current);
    }

    window.document.addEventListener("fullscreenchange", syncFullScreen);
    return () => window.document.removeEventListener("fullscreenchange", syncFullScreen);
  }, []);

  function toggleFullScreen() {
    if (window.document.fullscreenElement) {
      void window.document.exitFullscreen();
      return;
    }
    void containerRef.current?.requestFullscreen();
  }

  async function download() {
    setDownloading(true);
    setDownloadError(null);

    try {
      // A URL é pedida no clique: cada download vira um registro de auditoria (seção 81).
      const result = await requestDocumentDownloadUrl(documentId);
      window.open(result.url, "_blank", "noopener,noreferrer");
    } catch (error) {
      setDownloadError(
        error instanceof Error ? error.message : "Não foi possível baixar o arquivo.",
      );
    } finally {
      setDownloading(false);
    }
  }

  const versions = [...(document.files ?? [])].sort(
    (first, second) => second.versionNumber - first.versionNumber,
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader className="gap-2 pb-3">
        <CardTitle className="flex items-center gap-2 text-base">
          <FileText className="size-4 shrink-0 text-muted-foreground" />
          <span className="truncate" title={document.originalFileName ?? undefined}>
            {document.displayName ?? document.originalFileName ?? "Documento"}
          </span>
        </CardTitle>
        <p className="text-xs text-muted-foreground">
          {[
            document.fileExtension?.toUpperCase(),
            document.fileSize !== null ? formatBytes(document.fileSize) : null,
            pageCount > 1 ? `${pageCount} páginas` : null,
          ]
            .filter(Boolean)
            .join(" · ") || "Sem arquivo anexado"}
        </p>

        <div className="flex flex-wrap items-center gap-1.5">
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Reduzir"
            disabled={zoom <= ZOOM_MINIMUM || kind === "UNKNOWN"}
            onClick={() => setZoom((current) => Math.max(ZOOM_MINIMUM, current - ZOOM_STEP))}
          >
            <ZoomOut className="size-4" />
          </Button>
          <span className="w-12 text-center text-xs tabular-nums text-muted-foreground">
            {Math.round(zoom * 100)}%
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Ampliar"
            disabled={zoom >= ZOOM_MAXIMUM || kind === "UNKNOWN"}
            onClick={() => setZoom((current) => Math.min(ZOOM_MAXIMUM, current + ZOOM_STEP))}
          >
            <ZoomIn className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title="Girar 90°"
            disabled={kind === "UNKNOWN"}
            onClick={() => setRotation((current) => (current + 90) % 360)}
          >
            <RotateCw className="size-4" />
          </Button>
          <Button
            type="button"
            variant="outline"
            size="icon"
            title={fullScreen ? "Sair da tela cheia" : "Tela cheia"}
            onClick={toggleFullScreen}
          >
            {fullScreen ? <Minimize2 className="size-4" /> : <Maximize2 className="size-4" />}
          </Button>
          {versions.length > 0 && (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => setShowVersions((current) => !current)}
            >
              <History className="size-4" />
              Versões
              <Badge variant="secondary">{versions.length}</Badge>
            </Button>
          )}

          <div className="ml-auto">
            {canDownload ? (
              <Button type="button" variant="outline" size="sm" onClick={() => void download()}>
                {downloading ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <Download className="size-4" />
                )}
                Baixar
              </Button>
            ) : (
              // Sem a permissão o botão nem aparece — e o back-end recusaria de qualquer forma.
              <span className="text-xs text-muted-foreground">
                Download não permitido para o seu perfil
              </span>
            )}
          </div>
        </div>

        {pageCount > 1 && kind === "PDF" && (
          <div className="flex flex-wrap items-center gap-1 border-t pt-2">
            <span className="mr-1 text-xs text-muted-foreground">Páginas:</span>
            {Array.from({ length: pageCount }, (_, index) => index + 1).map((number) => (
              <Button
                key={number}
                type="button"
                size="sm"
                variant={number === page ? "default" : "outline"}
                className="h-7 w-8 p-0 text-xs tabular-nums"
                onClick={() => setPage(number)}
              >
                {number}
              </Button>
            ))}
          </div>
        )}
      </CardHeader>

      <CardContent className="flex flex-col gap-3">
        {downloadError && (
          <Alert variant="destructive">
            <AlertTitle>Download não concluído</AlertTitle>
            <AlertDescription>{downloadError}</AlertDescription>
          </Alert>
        )}

        {showVersions && <VersionHistory versions={versions} />}

        <div
          ref={containerRef}
          className="relative flex min-h-[28rem] items-center justify-center overflow-auto rounded-md border bg-muted/30 p-2"
        >
          {access.isLoading && <Skeleton className="h-[26rem] w-full" />}

          {access.isError && (
            <Alert variant="destructive" className="m-4">
              <AlertTitle>Não foi possível abrir o arquivo</AlertTitle>
              <AlertDescription>
                A URL de visualização não pôde ser emitida. Isso acontece quando o documento
                não tem arquivo armazenado ou quando o seu perfil não tem acesso a esta
                empresa.
              </AlertDescription>
            </Alert>
          )}

          {signedUrl && (
            <Preview
              kind={kind}
              url={signedUrl}
              page={page}
              zoom={zoom}
              rotation={rotation}
              document={document}
              inlineText={inline.data ?? null}
              inlineLoading={inline.isLoading}
              inlineError={inline.isError}
            />
          )}
        </div>

        <p className="text-xs text-muted-foreground">
          O arquivo original nunca é alterado: zoom, rotação e página valem apenas para esta
          visualização. O link de acesso é temporário e cada abertura fica registrada.
        </p>
      </CardContent>
    </Card>
  );
}

function Preview({
  kind,
  url,
  page,
  zoom,
  rotation,
  document,
  inlineText,
  inlineLoading,
  inlineError,
}: {
  kind: ViewerKind;
  url: string;
  page: number;
  zoom: number;
  rotation: number;
  document: IntakeDocument;
  inlineText: string | null;
  inlineLoading: boolean;
  inlineError: boolean;
}) {
  // A rotação gira o conteúdo; em 90°/270° o quadro precisa trocar largura por altura para
  // não cortar o documento.
  const rotated = rotation === 90 || rotation === 270;
  const transform = `rotate(${rotation}deg)`;

  if (kind === "PDF") {
    return (
      <div
        className="w-full"
        style={{ transform, height: rotated ? "26rem" : undefined }}
      >
        <iframe
          // O fragmento muda a página e o zoom do visualizador nativo, mas só é lido no
          // carregamento — a `key` força a remontagem quando o usuário troca de página.
          key={`${page}-${zoom}`}
          src={`${url}#page=${page}&zoom=${Math.round(zoom * 100)}`}
          title={document.originalFileName ?? "Documento"}
          className="h-[28rem] w-full rounded-sm border-0 bg-white"
        />
      </div>
    );
  }

  if (kind === "IMAGE") {
    return (
      // A URL é assinada e temporária: `next/image` exigiria domínio configurado e ainda
      // tentaria otimizar um arquivo privado, então aqui é a tag nativa mesmo.
      // eslint-disable-next-line @next/next/no-img-element
      <img
        src={url}
        alt={document.originalFileName ?? "Documento"}
        className="max-h-[40rem] origin-center object-contain transition-transform"
        style={{ transform: `${transform} scale(${zoom})` }}
      />
    );
  }

  if (kind === "XML" || kind === "TEXT") {
    if (inlineLoading) return <Skeleton className="h-[26rem] w-full" />;

    if (inlineError || inlineText === null) {
      return (
        <Alert className="m-4">
          <AlertTitle>Conteúdo não exibido aqui</AlertTitle>
          <AlertDescription>
            O arquivo não pôde ser lido diretamente no navegador. Use o download para abri-lo,
            se o seu perfil tiver essa permissão.
          </AlertDescription>
        </Alert>
      );
    }

    const truncated = inlineText.length > XML_PREVIEW_CHARACTER_LIMIT;
    const body = kind === "XML" ? formatXml(inlineText) : inlineText;

    return (
      <div className="w-full self-start">
        {truncated && (
          <p className="mb-2 text-xs text-muted-foreground">
            Arquivo grande: exibindo apenas o início do conteúdo.
          </p>
        )}
        <pre
          className="w-full origin-top-left overflow-auto rounded-sm bg-background p-3 text-xs leading-relaxed"
          style={{ transform: `scale(${zoom})`, transformOrigin: "top left" }}
        >
          {body.slice(0, XML_PREVIEW_CHARACTER_LIMIT)}
        </pre>
      </div>
    );
  }

  if (kind === "SPREADSHEET") {
    return <SpreadsheetSummary document={document} />;
  }

  return (
    <Alert className="m-4">
      <AlertTitle>Pré-visualização indisponível</AlertTitle>
      <AlertDescription>
        Este formato não é exibido dentro do sistema. O arquivo continua armazenado e pode ser
        baixado por quem tiver permissão.
      </AlertDescription>
    </Alert>
  );
}

/**
 * Resumo da planilha (seção 35).
 *
 * A planilha é lida no back-end durante a extração, não aqui: repetir a leitura no navegador
 * exigiria uma biblioteca pesada e daria um segundo resultado, possivelmente diferente do que
 * foi gravado. O que se mostra é o que a extração encontrou.
 */
function SpreadsheetSummary({ document }: { document: IntakeDocument }) {
  const fields = document.extractedFields ?? [];

  return (
    <div className="w-full self-start p-2">
      <div className="mb-3 flex items-center gap-2 text-sm font-medium">
        <FileSpreadsheet className="size-4 text-muted-foreground" />
        Resumo da planilha
      </div>

      {fields.length === 0 ? (
        <p className="text-sm text-muted-foreground">
          Nenhum dado foi extraído desta planilha. Use o download para abri-la em um editor.
        </p>
      ) : (
        <dl className="grid gap-2 sm:grid-cols-2">
          {fields.slice(0, 12).map((field) => (
            <div key={field.id} className="rounded-md border p-2">
              <dt className="text-xs text-muted-foreground">{field.fieldName}</dt>
              <dd className="truncate text-sm">
                {field.normalizedValue ?? field.originalValue ?? "—"}
              </dd>
            </div>
          ))}
        </dl>
      )}
    </div>
  );
}

/**
 * Histórico de versões (seções 35 e 57).
 *
 * Versões antigas ficam listadas como registro: o arquivo original nunca é sobrescrito, e o
 * link de acesso aponta sempre para a versão vigente.
 */
function VersionHistory({ versions }: { versions: IntakeDocumentFile[] }) {
  return (
    <div className="rounded-md border">
      <p className="border-b px-3 py-2 text-sm font-medium">Histórico de versões</p>
      <ul className="divide-y">
        {versions.map((version) => (
          <li key={version.id} className="flex flex-wrap items-center gap-2 px-3 py-2 text-sm">
            <Badge variant={version.isCurrent ? "default" : "secondary"}>
              v{version.versionNumber}
            </Badge>
            <span className="min-w-0 flex-1 truncate">{version.fileName ?? "—"}</span>
            {version.isOriginal && <Badge variant="outline">Original</Badge>}
            <span className="text-xs text-muted-foreground">
              {version.fileSize !== null ? formatBytes(version.fileSize) : "—"}
            </span>
            <span
              className={cn("text-xs text-muted-foreground", "hidden sm:inline")}
              title={version.fileHash ?? undefined}
            >
              {formatDateTimeBR(version.createdAt)}
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}

const IMAGE_EXTENSIONS = ["jpg", "jpeg", "png", "gif", "bmp", "webp", "heic", "heif"];
const SPREADSHEET_EXTENSIONS = ["xlsx", "xls", "csv", "ods"];
const TEXT_EXTENSIONS = ["txt", "json"];

/**
 * Decide como exibir o arquivo.
 *
 * O tipo real vem do back-end, que o determinou pelo conteúdo e não pela extensão informada
 * no envio (seção 10). Aqui a extensão só serve de desempate quando o MIME é genérico.
 */
export function viewerKindOf(document: IntakeDocument): ViewerKind {
  const mimeType = (document.mimeType ?? "").toLowerCase();
  const extension = (document.fileExtension ?? "").toLowerCase();

  if (mimeType === "application/pdf" || extension === "pdf") return "PDF";
  if (mimeType.startsWith("image/") || IMAGE_EXTENSIONS.includes(extension)) return "IMAGE";
  if (mimeType.includes("xml") || extension === "xml") return "XML";
  if (SPREADSHEET_EXTENSIONS.includes(extension)) return "SPREADSHEET";
  if (mimeType.startsWith("text/") || TEXT_EXTENSIONS.includes(extension)) return "TEXT";

  return "UNKNOWN";
}

/**
 * Indenta o XML para leitura.
 *
 * É formatação de exibição, não interpretação: nenhum valor é lido, convertido ou reordenado
 * — quem extrai dados do XML é o back-end.
 */
export function formatXml(source: string): string {
  const compact = source.replace(/>\s*</g, "><").trim();
  const lines: string[] = [];
  let depth = 0;

  for (const token of compact.split(/(<[^>]*>)/).filter((part) => part.trim() !== "")) {
    if (!token.startsWith("<")) {
      lines.push(`${"  ".repeat(depth)}${token.trim()}`);
      continue;
    }

    const isClosing = token.startsWith("</");
    const isSelfContained = token.endsWith("/>") || token.startsWith("<?") || token.startsWith("<!");

    if (isClosing) depth = Math.max(0, depth - 1);
    lines.push(`${"  ".repeat(depth)}${token}`);
    if (!isClosing && !isSelfContained) depth += 1;
  }

  return lines.join("\n");
}
