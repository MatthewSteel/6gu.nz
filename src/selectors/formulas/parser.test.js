import { lexFormula } from './lexer';
import { getCells, getSheets } from './selectors';
import { getCellValuesById } from './codegen';
import store, { setFormula } from '../../redux/store';
import { parseFormula, parseTokens } from './parser';

const getCellValue = (cellName) => {
  const cell = getCells(store.getState())
    .find(({ name }) => name === cellName);
  return getCellValuesById(store.getState())[cell.id].value;
};

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

  it('gets operator precedence right', () => {
    const s1 = getSheets(store.getState())[0];

    // precedence
    store.dispatch(setFormula({ context: s1.id, y: 0, x: 0 }, 'x=1+2*3'));
    expect(getCellValue('x')).toEqual(7); // not 9

    // left associativity
    store.dispatch(setFormula({ context: s1.id, y: 1, x: 0 }, 'y=2/2*2'));
    expect(getCellValue('y')).toEqual(2); // not 0.5

    // right associativity
    store.dispatch(setFormula({ context: s1.id, y: 1, x: 0 }, 'z=2**3**2'));
    expect(getCellValue('z')).toEqual(512); // not 64

    // recursion
    store.dispatch(setFormula(
      { context: s1.id, y: 1, x: 0 },
      'w=12 ** 1 * 2*3',
    ));
    expect(getCellValue('w')).toEqual(72); // not 12 ^ 6.
  });
});
