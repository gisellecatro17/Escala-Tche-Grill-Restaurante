import { ValidationOptions, registerDecorator } from 'class-validator';
import { cnpj } from 'cpf-cnpj-validator';

/** Valida um CNPJ (com ou sem máscara) usando o dígito verificador oficial. */
export function IsCnpj(validationOptions?: ValidationOptions) {
  return function (object: object, propertyName: string) {
    registerDecorator({
      name: 'isCnpj',
      target: object.constructor,
      propertyName,
      options: {
        message: 'Informe um CNPJ válido.',
        ...validationOptions,
      },
      validator: {
        validate(value: unknown) {
          return typeof value === 'string' && cnpj.isValid(value);
        },
      },
    });
  };
}
