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
    const formula = 'a.b(foo:bar.baz.arf[10], quux:1+"hi").fi\\ eld';
    const tokens = [
      { name: 'a' },
      { lookup: '.' },
      { name: 'b' },
      { open: '(' },
      { name: 'foo' },
      { assignment: ':' },
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
      { assignment: ':' },
      { value: 1 },
      { op: '+' },
      { value: 'hi' },
      { close: ')' },
      { lookup: '.' },
      { name: 'fi eld' },
    ];
    const expectedOutput = {
      lookup: 'fi eld',
      on: {
        call: { lookup: 'b', on: { name: 'a' } },
        args: [],
        kwargs: [{
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
    const s1 = getSheets(store.getState())[0];
    expect(parseFormula(':')).toEqual({});
    expect(parseFormula('foo :')).toEqual({ name: 'foo' });
    expect(parseFormula('foo : bar', s1.id)).toEqual({
      name: 'foo',
      formula: { lookup: 'bar', on: { ref: s1.id } },
    });
    expect(parseFormula('foo : bar +')).toEqual({
      name: 'foo',
      formula: { badFormula: 'bar +' },
    });
    expect(parseFormula('foo =: bar +')).toEqual({
      formula: { badFormula: 'foo =: bar +' },
    });
  });

  it('parses unary operators', () => {
    const formula = '-!+~func(param:-arg)+- foo';
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
                args: [],
                kwargs: [{
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
    store.dispatch(setFormula({ context: s1.id, y: 0, x: 0 }, 'x:1+2*3'));
    expect(getCellValue('x')).toEqual(7); // not 9

    // left associativity
    store.dispatch(setFormula({ context: s1.id, y: 1, x: 0 }, 'y:2/2*2'));
    expect(getCellValue('y')).toEqual(2); // not 0.5

    // right associativity
    store.dispatch(setFormula({ context: s1.id, y: 1, x: 0 }, 'z:2**3**2'));
    expect(getCellValue('z')).toEqual(512); // not 64

    // recursion
    store.dispatch(setFormula(
      { context: s1.id, y: 1, x: 0 },
      'w:12 ** 1 * 2*3',
    ));
    expect(getCellValue('w')).toEqual(72); // not 12 ^ 6.
  });

  it('parses an empty array', () => {
    const formula = '[]';
    const expectedOutput = { array: [] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an array of one element', () => {
    const formula = '["hi"]';
    const expectedOutput = { array: [{ value: 'hi' }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an array of two elements', () => {
    const formula = '["hi", 1]';
    const expectedOutput = { array: [{ value: 'hi' }, { value: 1 }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an array of two elements with a trailing comma', () => {
    const formula = '["hi", 1,]';
    const expectedOutput = { array: [{ value: 'hi' }, { value: 1 }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses nested arrays', () => {
    const formula = '[["hi"]]';
    const expectedOutput = {
      array: [{
        array: [{ value: 'hi' }],
      }],
    };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an empty object', () => {
    const formula = '{}';
    const expectedOutput = { object: [] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses more complicated objects', () => {
    const formula = '{foo, bar: 10, baz.quux,}';
    const expectedOutput = { object: [{
      key: 'foo',
      value: { name: 'foo' },
    }, {
      key: 'bar',
      value: { value: 10 },
    }, {
      key: 'quux',
      value: { lookup: 'quux', on: { name: 'baz' } },
    }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });
});
