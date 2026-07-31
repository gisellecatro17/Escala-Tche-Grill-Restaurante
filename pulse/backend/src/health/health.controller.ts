import { Controller, Get } from '@nestjs/common';
import { ApiOperation, ApiTags } from '@nestjs/swagger';

import { Public } from '../common/decorators/public.decorator';
import { ApiMessage } from '../common/decorators/api-message.decorator';

@ApiTags('Status')
@Controller()
export class HealthController {
  @Get('health')
  @Public()
  @ApiMessage('Pulse API operando normalmente.')
  @ApiOperation({ summary: 'Verifica a disponibilidade da API.' })
  check() {
    return { status: 'ok', timestamp: new Date().toISOString() };
  }
}
