import { lexFormula } from './lexer';
import { parseTokens, unparseTerm } from './parser';

describe('unparseTerm', () => {
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
    const expectedOutput = {
      formula: [{
        args: [{
          name: { name: 'foo' },
          expr: [{ lookup: { name: 'baz' }, name: 'bar' }],
        }, {
          name: { name: 'quux' },
          expr: [{ value: 1 }, { op: '+' }, { value: 'hi' }],
        }],
        call: { lookup: { name: 'b' }, name: 'a' },
        lookup: { name: 'field' },
      }],
    };

    expect(lexFormula(formula)).toEqual(tokens); // Just in case...
    expect(parseTokens(tokens)).toEqual(expectedOutput);
  });
});
