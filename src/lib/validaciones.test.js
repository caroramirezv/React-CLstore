import { describe, it, expect } from 'vitest';
import {
  formatoCLP,
  validarRunChileno,
  formatearRun,
  validarDominioCorreo,
  calcularPrecioFinal,
} from './validaciones';

describe('formatoCLP', () => {
  it.each([
    [0, '$0'],
    [1000, '$1.000'],
    [59990, '$59.990'],
    [1234567, '$1.234.567'],
  ])('formatea %i como %s', (entrada, esperado) => {
    expect(formatoCLP(entrada)).toBe(esperado);
  });

  it('redondea los decimales (1999.6 → $2.000)', () => {
    expect(formatoCLP(1999.6)).toBe('$2.000');
  });

  it('devuelve $0 con null, undefined o NaN', () => {
    expect(formatoCLP(null)).toBe('$0');
    expect(formatoCLP(undefined)).toBe('$0');
    expect(formatoCLP(NaN)).toBe('$0');
  });
});

describe('validarRunChileno', () => {
  it.each(['12.345.678-5', '12345678-5', '11.111.111-1', '10.000.013-K'])(
    'acepta el RUN válido %s',
    (run) => expect(validarRunChileno(run)).toBe(true)
  );

  it.each(['12.345.678-9', 'abc', '', '1-9'])(
    'rechaza el RUN inválido "%s"',
    (run) => expect(validarRunChileno(run)).toBe(false)
  );

  it('acepta la K en minúscula', () => {
    expect(validarRunChileno('10.000.013-k')).toBe(true);
  });
});

describe('formatearRun', () => {
  it('quita puntos, guión y espacios, y pasa a mayúscula', () => {
    expect(formatearRun('12.345.678-k')).toBe('12345678K');
  });
});

describe('validarDominioCorreo', () => {
  it.each(['a@duoc.cl', 'a@profesor.duoc.cl', 'a@gmail.com', 'A@GMAIL.COM'])(
    'acepta %s',
    (correo) => expect(validarDominioCorreo(correo)).toBe(true)
  );

  it.each(['a@hotmail.com', 'a@duoc.cl.com', 'sin-arroba'])(
    'rechaza %s',
    (correo) => expect(validarDominioCorreo(correo)).toBe(false)
  );
});
describe('calcularPrecioFinal', () => {
  it('sin descuento (null) devuelve el precio original y enOferta=false', () => {
    expect(calcularPrecioFinal({ precio: 10000, descuento_porcentaje: null })).toEqual({
      precioOriginal: 10000,
      precioFinal: 10000,
      enOferta: false,
      descuento: 0,
    });
  });

  it.each([
    [0, 10000, false],
    [15, 8500, true],
    [50, 5000, true],
    [100, 0, true],
  ])('con %i%% de descuento el precio final de 10000 es %i (enOferta=%s)', (descuento, esperado, enOferta) => {
    const r = calcularPrecioFinal({ precio: 10000, descuento_porcentaje: descuento });
    expect(r.precioFinal).toBe(esperado);
    expect(r.enOferta).toBe(enOferta);
  });

  it('redondea el precio final (9999 con 15% → 8499)', () => {
    expect(calcularPrecioFinal({ precio: 9999, descuento_porcentaje: 15 }).precioFinal).toBe(8499);
  });

  it('acepta valores numéricos en texto (como vienen de un input)', () => {
    const r = calcularPrecioFinal({ precio: '10000', descuento_porcentaje: '20' });
    expect(r.precioFinal).toBe(8000);
    expect(r.descuento).toBe(20);
  });

  it('con producto undefined o null devuelve todo en cero sin lanzar error', () => {
    expect(calcularPrecioFinal(undefined)).toEqual({ precioOriginal: 0, precioFinal: 0, enOferta: false, descuento: 0 });
    expect(calcularPrecioFinal(null).precioFinal).toBe(0);
  });
});