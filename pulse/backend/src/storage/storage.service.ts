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

/** Encapsula o acesso ao Supabase Storage. Estrutura preparada para migração futura
 * para Amazon S3 ou Cloudflare R2 sem alterar os consumidores deste serviço. */
@Injectable()
export class StorageService {
  private readonly bucket: string;

  constructor(
    private readonly supabaseAdmin: SupabaseAdminService,
    private readonly config: ConfigService,
  ) {
    this.bucket =
      this.config.get<string>('SUPABASE_STORAGE_BUCKET') ?? 'pulse-public';
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
