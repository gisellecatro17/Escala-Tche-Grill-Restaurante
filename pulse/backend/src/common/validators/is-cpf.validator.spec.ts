import { validate } from 'class-validator';

import { IsCpf } from './is-cpf.validator';

class DummyDto {
  @IsCpf()
  document: string;

  constructor(document: string) {
    this.document = document;
  }
}

describe('IsCpf (validação de documento)', () => {
  it('aceita um CPF com dígito verificador válido', async () => {
    const errors = await validate(new DummyDto('529.982.247-25'));
    expect(errors).toHaveLength(0);
  });

  it('rejeita um CPF com dígito verificador inválido', async () => {
    const errors = await validate(new DummyDto('529.982.247-00'));
    expect(errors.length).toBeGreaterThan(0);
    expect(errors[0].constraints).toHaveProperty('isCpf');
  });

  it('rejeita valores com quantidade de dígitos incorreta', async () => {
    const errors = await validate(new DummyDto('123'));
    expect(errors.length).toBeGreaterThan(0);
  });
});
