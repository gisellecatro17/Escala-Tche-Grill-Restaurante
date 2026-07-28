import { SetMetadata } from '@nestjs/common';

export const API_MESSAGE_KEY = 'api_message';

/**
 * Define a mensagem de sucesso retornada no envelope padrão da API para esta rota.
 * Ex.: @ApiMessage('Empresa criada com sucesso.')
 */
export const ApiMessage = (message: string) =>
  SetMetadata(API_MESSAGE_KEY, message);
