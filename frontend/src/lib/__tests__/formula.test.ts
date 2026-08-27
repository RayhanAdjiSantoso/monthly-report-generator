import { describe, expect, it } from 'vitest';
import { evaluateFormula, FormulaError, validateFormula } from '../formula';

describe('evaluateFormula', () => {
  it('evaluates a plain number', () => {
    expect(evaluateFormula('42', {})).toBe(42);
  });

  it('evaluates a single variable, case-insensitively', () => {
    expect(evaluateFormula('biaya', { biaya: 100 })).toBe(100);
    expect(evaluateFormula('BIAYA', { biaya: 100 })).toBe(100);
  });

  it('applies standard operator precedence (* and / before + and -)', () => {
    expect(evaluateFormula('2 + 3 * 4', {})).toBe(14);
    expect(evaluateFormula('2 * 3 + 4', {})).toBe(10);
  });

  it('respects parentheses', () => {
    expect(evaluateFormula('(2 + 3) * 4', {})).toBe(20);
  });

  it('supports unary minus', () => {
    expect(evaluateFormula('-5 + 10', {})).toBe(5);
    expect(evaluateFormula('10 * -2', {})).toBe(-20);
  });

  it('computes a real ratio metric from named variables', () => {
    expect(evaluateFormula('biaya / pesanan', { biaya: 1000, pesanan: 4 })).toBe(250);
  });

  it('computes a nested formula combining several variables', () => {
    expect(evaluateFormula('(biaya - penjualan) / pesanan', { biaya: 500, penjualan: 2000, pesanan: 5 })).toBe(-300);
  });

  it('returns 0 for division by zero instead of Infinity/NaN', () => {
    expect(evaluateFormula('biaya / pesanan', { biaya: 100, pesanan: 0 })).toBe(0);
  });

  it('handles decimal numbers', () => {
    expect(evaluateFormula('1.5 * 2', {})).toBe(3);
  });

  it('throws FormulaError for an unknown variable', () => {
    expect(() => evaluateFormula('bukanmetrik', { biaya: 1 })).toThrow(FormulaError);
  });

  it('throws FormulaError for an empty formula', () => {
    expect(() => evaluateFormula('', {})).toThrow(FormulaError);
    expect(() => evaluateFormula('   ', {})).toThrow(FormulaError);
  });

  it('throws FormulaError for unbalanced parentheses', () => {
    expect(() => evaluateFormula('(biaya + pesanan', { biaya: 1, pesanan: 1 })).toThrow(FormulaError);
  });

  it('throws FormulaError for a dangling operator', () => {
    expect(() => evaluateFormula('biaya +', { biaya: 1 })).toThrow(FormulaError);
  });

  it('throws FormulaError for a trailing unexpected token', () => {
    expect(() => evaluateFormula('biaya 5', { biaya: 1 })).toThrow(FormulaError);
  });

  it('throws FormulaError for an unrecognized character (rejects arbitrary code, e.g. no access to JS globals)', () => {
    expect(() => evaluateFormula('biaya; alert(1)', { biaya: 1 })).toThrow(FormulaError);
    expect(() => evaluateFormula('window.location', { biaya: 1 })).toThrow(FormulaError);
  });
});

describe('validateFormula', () => {
  it('returns null for a valid formula using only whitelisted variables', () => {
    expect(validateFormula('biaya / pesanan', ['biaya', 'pesanan'])).toBeNull();
  });

  it('returns an error message for an unknown variable', () => {
    expect(validateFormula('biaya / tidakAda', ['biaya', 'pesanan'])).toContain('tidakAda');
  });

  it('returns an error message for invalid syntax', () => {
    expect(validateFormula('biaya / / pesanan', ['biaya', 'pesanan'])).not.toBeNull();
  });
});
