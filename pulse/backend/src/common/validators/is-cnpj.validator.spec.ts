import { validate } from 'class-validator';

import { IsCnpj } from './is-cnpj.validator';

class DummyDto {
  @IsCnpj()
  document: string;

  constructor(document: string) {
    this.document = document;
  }
}

describe('IsCnpj (validação de documento)', () => {
  it('aceita um CNPJ com dígito verificador válido', async () => {
    const errors = await validate(new DummyDto('11.222.333/0001-81'));
    expect(errors).toHaveLength(0);
  });

  it('rejeita um CNPJ com dígito verificador inválido', async () => {
    const errors = await validate(new DummyDto('11.222.333/0001-00'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isCnpj');
  });

  it('rejeita valores com quantidade de dígitos incorreta', async () => {
    const errors = await validate(new DummyDto('123'));
    expect(errors.length).toBeGreaterThan(0);
  });
});
