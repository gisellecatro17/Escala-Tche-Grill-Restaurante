import { BadRequestException, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';

import { SupabaseAdminService } from '../supabase/supabase-admin.service';

const ALLOWED_LOGO_MIME_TYPES: Record<string, string> = {
  'image/png': 'png',
  'image/jpeg': 'jpg',
  'image/webp': 'webp',
};

export const MAX_LOGO_SIZE_BYTES = 5 * 1024 * 1024; // 5MB
export const MAX_DOCUMENT_SIZE_BYTES = 15 * 1024 * 1024; // 15MB

/** Validade da URL assinada de um documento de entrada, em segundos (seção 11). */
export const SIGNED_URL_TTL_SECONDS = 300;

/** Encapsula o acesso ao Supabase Storage. Estrutura preparada para migração futura
 * para Amazon S3 ou Cloudflare R2 sem alterar os consumidores deste serviço. */
@Injectable()
export class StorageService {
  private readonly bucket: string;
  /**
   * Bucket **privado**, separado do público das logos. Documento financeiro não pode ter
   * URL pública: o acesso sai sempre por URL assinada de curta duração (seção 11 do
   * prompt de entrada de documentos).
   */
  private readonly privateBucket: string;

  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly config: ConfigService,
  ) {
    this.bucket =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'pulse-public';
    this.privateBucket =
      this.config.get<string>('SUPABASE_PRIVATE_STORAGE_BUCKET') ??
      'pulse-private';
  }

  async uploadCompanyLogo(
    companyId: string,
    file: Express.Multer.File,
  ): Promise<string> {
    const extension = ALLOWED_LOGO_MIME_TYPES[file.mimetype];

    if (!extension) {
      throw new BadRequestException(
        'Formato de arquivo inválido. Envie um arquivo PNG, JPG ou WEBP.',
      );
    }

    if (file.size > MAX_LOGO_SIZE_BYTES) {
      throw new BadRequestException(
        'O arquivo enviado excede o tamanho máximo permitido (5MB).',
      );
    }

    const path = `companies/${companyId}/logo-${Date.now()}.${extension}`;

    const { error } = await this.supabaseAdmin.client.storage
      .from(this.bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      throw new BadRequestException(
        `Não foi possível enviar a logo: ${error.message}`,
      );
    }

    const { data } = this.supabaseAdmin.client.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return data.publicUrl;
  }

  /** Envia um documento genérico (contrato, comprovante, certidão etc.) vinculado a
   * qualquer entidade do sistema, identificada por entityType/entityId (seção 44 do
   * prompt de fornecedores — estrutura de anexos reutilizável). */
  async uploadDocument(
    entityType: string,
    entityId: string,
    file: Express.Multer.File,
  ): Promise<{ storagePath: string; publicUrl: string }> {
    if (file.size > MAX_DOCUMENT_SIZE_BYTES) {
      throw new BadRequestException(
        'O arquivo enviado excede o tamanho máximo permitido (15MB).',
      );
    }

    const safeName = file.originalname.replace(/[^\w.-]+/g, '_');
    const path = `documents/${entityType}/${entityId}/${Date.now()}-${safeName}`;

    const { error } = await this.supabaseAdmin.client.storage
      .from(this.bucket)
      .upload(path, file.buffer, { contentType: file.mimetype, upsert: true });

    if (error) {
      throw new BadRequestException(
        `Não foi possível enviar o documento: ${error.message}`,
      );
    }

    const { data } = this.supabaseAdmin.client.storage
      .from(this.bucket)
      .getPublicUrl(path);

    return { storagePath: path, publicUrl: data.publicUrl };
  }

  // ── Storage privado (entrada de documentos) ───────────────────────────────

  /**
   * Envia um documento financeiro para o bucket **privado**.
   *
   * O caminho é montado pelo chamador e inclui organização e empresa, de modo que a
   * separação física acompanhe a separação lógica dos dados (seção 11). Não usa
   * `upsert`: sobrescrever silenciosamente um documento já armazenado apagaria a versão
   * anterior, e o módulo exige versionamento.
   */
  async uploadPrivateDocument(
    storagePath: string,
    buffer: Buffer,
    contentType: string,
  ): Promise<{ storagePath: string; bucket: string }> {
    const { error } = await this.supabaseAdmin.client.storage
      .from(this.privateBucket)
      .upload(storagePath, buffer, { contentType, upsert: false });

    if (error) {
      throw new BadRequestException(
        `Não foi possível armazenar o documento: ${error.message}`,
      );
    }

    return { storagePath, bucket: this.privateBucket };
  }

  /**
   * Gera uma URL temporária para visualizar ou baixar um documento privado.
   *
   * A URL expira em `SIGNED_URL_TTL_SECONDS`. Quem chama precisa ter validado a
   * permissão **antes**: este serviço não conhece o usuário, só o caminho.
   */
  async createSignedUrl(
    storagePath: string,
    expiresInSeconds = SIGNED_URL_TTL_SECONDS,
  ): Promise<{ url: string; expiresAt: Date }> {
    const { data, error } = await this.supabaseAdmin.client.storage
      .from(this.privateBucket)
      .createSignedUrl(storagePath, expiresInSeconds);

    if (error || !data?.signedUrl) {
      throw new BadRequestException(
        `Não foi possível gerar o link do documento: ${error?.message ?? 'resposta vazia'}`,
      );
    }

    return {
      url: data.signedUrl,
      expiresAt: new Date(Date.now() + expiresInSeconds * 1000),
    };
  }

  /** Baixa o conteúdo de um documento privado para reprocessamento no servidor. */
  async downloadPrivateDocument(storagePath: string): Promise<Buffer> {
    const { data, error } = await this.supabaseAdmin.client.storage
      .from(this.privateBucket)
      .download(storagePath);

    if (error || !data) {
      throw new BadRequestException(
        `Não foi possível ler o documento armazenado: ${error?.message ?? 'resposta vazia'}`,
      );
    }

    return Buffer.from(await data.arrayBuffer());
  }

  /**
   * Remove um documento do bucket privado.
   *
   * Usado apenas quando o registro nunca chegou a existir (falha no meio do upload). A
   * exclusão de documento já cadastrado é **lógica**: o arquivo permanece até o prazo de
   * retenção configurado.
   */
  async removePrivateDocument(storagePath: string): Promise<void> {
    await this.supabaseAdmin.client.storage
      .from(this.privateBucket)
      .remove([storagePath]);
  }

  async removeCompanyLogo(logoUrl: string): Promise<void> {
    const path = this.extractPathFromPublicUrl(logoUrl);

    if (!path) return;

    await this.supabaseAdmin.client.storage.from(this.bucket).remove([path]);
  }

  private extractPathFromPublicUrl(logoUrl: string): string | null {
    const marker = `/object/public/${this.bucket}/`;
    const index = logoUrl.indexOf(marker);

    if (index === -1) return null;

    return logoUrl.slice(index + marker.length);
  }
}
