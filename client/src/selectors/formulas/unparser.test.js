import { unlexToken, unparseTerm } from './unparser';
import { translateExpr } from './selectors';

describe('unparser', () => {
  it('unparses a complicated call', () => {
    const term = {
      lookup: 'field2',
      on: {
        call: { name: 'called_cell' },
        args: [],
        kwargs: [{
          ref: { name: 's_c' },
          expr: {
            binary: '*',
            left: {
              lookupIndex: { value: 10 },
              on: {
                lookup: 'field',
                on: { name: 'other cell' },
              },
            },
            right: { value: 5 },
          },
        }],
      },
    };
    const unparsed = translateExpr(term, null, unparseTerm);
    expect(unparsed).toEqual([
      { name: 'called_cell' },
      { open: '(' },
      { name: 's_c' },
      { assignment: ':' },
      { whitespace: ' ' },
      { name: 'other cell' },
      { lookup: '.' },
      { name: 'field' },
      { openBracket: '[' },
      { value: 10 },
      { closeBracket: ']' },
      { whitespace: ' ' },
      { op: '*' },
      { whitespace: ' ' },
      { value: 5 },
      { close: ')' },
      { lookup: '.' },
      { name: 'field2' },
    ]);
    const unlexed = unparsed.map(unlexToken(null)).join('');
    expect(unlexed).toEqual('called_cell(s_c: other\\ cell.field[10] * 5).field2');
  });
});
