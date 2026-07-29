import { ValidationOptions, registerDecorator } from 'class-validator';
import { cpf } from 'cpf-cnpj-validator';

/** Valida um CPF (com ou sem máscara) usando o dígito verificador oficial. */
export function IsCpf(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCpf',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Informe um CPF válido.',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && cpf.isValid(value);
        },
      },
    });
  };
}
