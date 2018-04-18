import { TableArray } from './tables';

describe('TableArray', () => {
  let table;
  beforeEach(() => {
    table = new TableArray([{
      error: 'Whole entry failed',
    }, {
      value: {
        byName: {
          id: { error: 'Aaaah!' },
          k1: { value: 'foo' },
          k2: { value: 'bar' },
        },
      },
    }, {
      value: {
        byName: {
          id: { value: 'baz' },
          k1: { value: 'quux' },
          k2: { error: 'some other error' },
        },
      },
    }]);
  });

  it('stores the keys right', () => {
    expect(table.isTable()).toBe(true); // init the keys
    expect(table.keys).toEqual(['k2', 'k1', 'id']);
  });

  it('gets columns right before/after memoization', () => {
    [0, 1].forEach(() => {
      expect(table.getColumn('id').arr).toEqual([
        { error: 'Whole entry failed' },
        { value: undefined }, // looking up an error gives no value
        { value: 'baz' },
      ]);
      expect(table.getColumn('k2').arr).toEqual([
        { error: 'Whole entry failed' },
        { value: 'bar' },
        { value: undefined },
      ]);
      expect(table.getColumn('k3').arr).toEqual([
        { error: 'Whole entry failed' },
        { error: 'Error: Lookup item does not have a field "k3"' },
        { error: 'Error: Lookup item does not have a field "k3"' },
      ]);
    });
  });

  it('answers "is this a table?" right', () => {
    expect(table.isTable()).toBe(true);
    const table2 = new TableArray([]);
    expect(table2.isTable()).toBe(false);
    const table3 = new TableArray([1, 2, 3]);
    expect(table3.isTable()).toBe(false);
  });
});
