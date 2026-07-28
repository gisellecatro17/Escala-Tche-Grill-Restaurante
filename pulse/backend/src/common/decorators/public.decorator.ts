import { SetMetadata } from '@nestjs/common';

export const IS_PUBLIC_KEY = 'is_public';

/** Marca uma rota como pública, dispensando o SupabaseAuthGuard. */
export const Public = () => SetMetadata(IS_PUBLIC_KEY, true);
