import store from '../../redux/store';
import { setFormula } from '../../redux/documentEditing';
import { getCells, getRefsById, getSheets, lookupExpression } from './selectors';
import { getCellValuesById } from './codegen';
import { ARRAY, LOGIN_STATES } from '../../redux/stateConstants';
import { blankDocument } from '../../redux/backend';

const getCell = cellName => (
  getCells(store.getState()).find(({ name }) => name === cellName));
const getCellValue = cellName => getCellValuesById(store.getState())[getCell(cellName).id];

const makeFormula = (context, formula) => (
  store.dispatch(setFormula({ y: 0, x: 0, ...context }, formula)));


describe('formula selectors', () => {
  beforeEach(() => {
    store.dispatch({
      type: 'USER_STATE',
      payload: {
        userState: { loginState: LOGIN_STATES.LOGGED_IN, documents: [] },
        openDocument: blankDocument(),
      },
    });
  });

  it('turns deep refs back into qualified lookups', () => {
    const [s1, s2] = getSheets(store.getState());
    makeFormula({ context: s1.id }, 'x:1');

    const xId = getCell('x').id;
    const refsById = getRefsById(store.getState());
    expect(lookupExpression(refsById, s1.id, xId)).toEqual({ ref: xId });
    expect(lookupExpression(refsById, s2.id, xId)).toEqual({
      lookup: 'x',
      lookupType: '.',
      on: { ref: s1.id },
    });

    expect(lookupExpression(refsById, s2.id, s1.id)).toEqual({ ref: s1.id });
  });

  it('gives good errors for bad formulas', () => {
    const s1 = getSheets(store.getState())[0];
    makeFormula({ context: s1.id }, 'x:(');

    // FIXME: should be `x`, not `a1`.
    expect(getCellValue('x')).toEqual({
      error: 'Error: Bad formula',
      override: false,
    });
  });

  it('resets function params after the call is done', () => {
    // Nasty bug...
    const s1 = getSheets(store.getState())[0];
    makeFormula({ context: s1.id, y: 0 }, 'v: 0');
    makeFormula({ context: s1.id, y: 1 }, 't: 1');
    makeFormula({ context: s1.id, y: 2 }, 'f: v > t');
    makeFormula({ context: s1.id, y: 3 }, 'f2: f(v: 3)');

    expect(getCellValue('v')).toEqual({ value: 0, override: false });
    expect(getCellValue('t')).toEqual({ value: 1, override: false });
    expect(getCellValue('f')).toEqual({ value: false, override: false });
    expect(getCellValue('f2')).toEqual({ value: true, override: false });
  });

  it('handles complex overrides', () => {
    const s1 = getSheets(store.getState())[0];
    makeFormula({ context: s1.id, y: 0 }, 'arr: [1,2,3]');
    makeFormula({ context: s1.id, y: 10 }, 'a1: arr[1]');
    makeFormula({ context: s1.id, y: 12 }, 'overr: a1(arr: [4,5,6])');

    const arr = getCell('arr');
    expect(arr.type).toBe(ARRAY); // not a "simple cell"

    expect(getCellValue('a1')).toEqual({ value: 2, override: false });
    expect(getCellValue('overr')).toEqual({ value: 5, override: false });
  });
});
