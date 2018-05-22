import { lexFormula } from './lexer';
import { parseFormula, parseTokens } from './parser';

describe('parser', () => {
  it('parses a complicated call', () => {
    const formula = 'a.b(foo=bar.baz.arf[10], quux=1+"hi").field';
    const tokens = [
      { name: 'a' },
      { lookup: '.' },
      { name: 'b' },
      { open: '(' },
      { name: 'foo' },
      { assignment: '=' },
      { name: 'bar' },
      { lookup: '.' },
      { name: 'baz' },
      { lookup: '.' },
      { name: 'arf' },
      { openBracket: '[' },
      { value: 10 },
      { closeBracket: ']' },
      { comma: ',' },
      { name: 'quux' },
      { assignment: '=' },
      { value: 1 },
      { op: '+' },
      { value: 'hi' },
      { close: ')' },
      { lookup: '.' },
      { name: 'field' },
    ];
    const expectedOutput = {
      lookup: 'field',
      on: {
        call: { lookup: 'b', on: { name: 'a' } },
        args: [{
          ref: { name: 'foo' },
          expr: {
            lookupIndex: { value: 10 },
            on: {
              lookup: 'arf',
              on: {
                lookup: 'baz',
                on: { name: 'bar' },
              },
            },
          },
        }, {
          ref: { name: 'quux' },
          expr: { binary: '+', left: { value: 1 }, right: { value: 'hi' } },
        }],
      },
    };

    expect(lexFormula(formula)).toEqual(tokens); // Just in case...
    expect(parseTokens(tokens, 0)).toEqual(expectedOutput);
  });

  it('parses strings appropriately', () => {
    expect(parseFormula('=')).toEqual({});
    expect(parseFormula('foo =')).toEqual({ name: 'foo' });
    expect(parseFormula('foo = bar')).toEqual({
      name: 'foo',
      formula: { name: 'bar' },
    });
    expect(parseFormula('foo = bar +')).toEqual({
      name: 'foo',
      formula: { badFormula: 'bar +' },
    });
    expect(parseFormula('foo := bar +')).toEqual({
      formula: { badFormula: 'foo := bar +' },
    });
  });

  it('parses unary operators', () => {
    const formula = '-!+~func(param=-arg)+- foo';
    const expectedOutput = {
      binary: '+',
      left: {
        unary: '-',
        on: {
          unary: '!',
          on: {
            unary: '+',
            on: {
              unary: '~',
              on: {
                call: { name: 'func' },
                args: [{
                  ref: { name: 'param' },
                  expr: {
                    unary: '-',
                    on: { name: 'arg' },
                  },
                }],
              },
            },
          },
        },
      },
      right: {
        unary: '-',
        on: { name: 'foo' },
      },
    };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });
});
