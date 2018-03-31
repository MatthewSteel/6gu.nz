import { lexFormula } from './lexer';
import { parseFormula, parseTokens, unparseTerm } from './parser';

describe('parser', () => {
  it('unparses a complicated call', () => {
    const term = {
      call: { name: 'called_cell' },
      args: [{
        ref: { name: 't.c' },
        expr: [{
          name: 'other_cell',
          lookup: {
            name: 'field',
          },
        }, {
          op: '*',
        }, {
          value: 5,
        }],
      }],
      lookup: { name: 'field2' },
    };
    expect(unparseTerm(term)).toEqual('called_cell(t.c=other_cell.field * 5).field2');
  });

  it('parses a complicated call', () => {
    const formula = 'a.b(foo=bar.baz, quux=1+"hi").field';
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
    const expectedOutput = [{
      call: { lookup: { name: 'b' }, name: 'a' },
      args: [{
        name: { name: 'foo' },
        expr: [{ lookup: { name: 'baz' }, name: 'bar' }],
      }, {
        name: { name: 'quux' },
        expr: [{ value: 1 }, { op: '+' }, { value: 'hi' }],
      }],
      lookup: { name: 'field' },
    }];

    expect(lexFormula(formula)).toEqual(tokens); // Just in case...
    expect(parseTokens(tokens, 0)).toEqual(expectedOutput);
  });

  it('parses strings appropriately', () => {
    expect(parseFormula('=')).toEqual({});
    expect(parseFormula('foo =')).toEqual({ name: 'foo' });
    expect(parseFormula('foo = bar')).toEqual({
      name: 'foo',
      formula: [{ name: 'bar' }],
    });
    expect(parseFormula('foo = bar +')).toEqual({
      name: 'foo',
      formula: [{ badFormula: ' bar +' }],
    });
    expect(parseFormula('foo := bar +')).toEqual({
      formula: [{ badFormula: 'foo := bar +' }],
    });
  });
});
