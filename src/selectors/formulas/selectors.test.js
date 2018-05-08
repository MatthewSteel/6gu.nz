import store, { deleteThing, setFormula } from '../../redux/store';
import { getCells, getSheets, lookupExpression } from './selectors';

const getCell = cellName =>
  getCells(store.getState()).find(({ name }) => name === cellName);

describe('formula selectors', () => {
  beforeEach(() => {
    getCells(store.getState()).forEach((cell) => {
      store.dispatch(deleteThing(cell.id));
    });
  });

  it('turns deep refs back into qualified lookups', () => {
    const [s1, s2] = getSheets(store.getState());
    store.dispatch(setFormula({ context: s1.id, y: 0, x: 0 }, 'x=1'));

    const xId = getCell('x').id;
    expect(lookupExpression(s1.id, xId)).toEqual({ ref: xId });
    expect(lookupExpression(s2.id, xId)).toEqual({
      lookup: 'x',
      on: { ref: s1.id },
    });

    expect(lookupExpression(s2.id, s1.id)).toEqual({ ref: s1.id });
  });
});
