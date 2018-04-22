import { unparseTerm } from './unparser';
import { translateTerm } from './selectors';

describe('unparser', () => {
  it('unparses a complicated call', () => {
    const term = {
      call: { name: 'called_cell' },
      args: [{
        ref: { name: 's.c' },
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
    expect(translateTerm(term, null, unparseTerm)).toEqual('called_cell(s.c=other_cell.field * 5).field2');
  });
});
