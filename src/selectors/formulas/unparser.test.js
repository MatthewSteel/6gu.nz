import { unparseTerm } from './unparser';
import { translateExpr } from './selectors';

describe('unparser', () => {
  it('unparses a complicated call', () => {
    const term = {
      lookup: 'field2',
      on: {
        call: { name: 'called_cell' },
        args: [{
          ref: { name: 's.c' },
          expr: {
            binary: '*',
            left: {
              lookupIndex: { value: 10 },
              on: {
                lookup: 'field',
                on: { name: 'other_cell' },
              },
            },
            right: { value: 5 },
          },
        }],
      },
    };
    expect(translateExpr(term, null, unparseTerm)).toEqual('called_cell(s.c: other_cell.field[10] * 5).field2');
  });
});
