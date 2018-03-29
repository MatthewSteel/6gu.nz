import { unparseTerm } from './parser';

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
    };
    expect(unparseTerm(term)).toEqual('called_cell(t.c=other_cell.field * 5)');
  });
});
