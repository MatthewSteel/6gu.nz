import store from '../../redux/store';
import { setFormula } from '../../redux/documentEditing';
import { getCells, getSheets } from './selectors';
import { getCellValuesById } from './codegen';
import { LOGIN_STATES } from '../../redux/stateConstants';
import { blankDocument } from '../../redux/backend';
import { toRaw1 } from './builtins';

const getCell = cellName => (
  getCells(store.getState()).find(({ name }) => name === cellName));

const getCellValue = (cellName) => {
  const cellId = getCell(cellName).id;
  const { value } = getCellValuesById(store.getState())[cellId];
  return toRaw1(value);
};

const makeFormula = (context, formula) => (
  store.dispatch(setFormula({ y: 0, x: 0, ...context }, formula)));


describe('built-in functions and operators', () => {
  beforeEach(() => {
    store.dispatch({
      type: 'USER_STATE',
      payload: {
        userState: { loginState: LOGIN_STATES.LOGGED_IN, documents: [] },
        openDocument: blankDocument(),
      },
    });
  });

  it('does single lookups reasonably', () => {
    const [s1] = getSheets(store.getState());
    makeFormula({ context: s1.id }, 'x:range(10)');

    makeFormula({ context: s1.id, y: 10 }, 'y: x :: 5');
    expect(getCellValue('y')).toEqual(5);

    makeFormula({ context: s1.id, y: 11 }, 'z: x :: [5, 5, 5, [11, 6]]');
    expect(getCellValue('z')).toEqual([5, 5, 5, [null, 6]]);
  });

  it('does multiple lookups reasonably', () => {
    const [s1] = getSheets(store.getState());
    makeFormula({ context: s1.id }, 'x:[1, 1, 2, 3, 4, 5]');

    makeFormula({ context: s1.id, y: 10 }, 'y: x ::: 1');
    expect(getCellValue('y')).toEqual([0, 1]);

    makeFormula({ context: s1.id, y: 11 }, 'z: x ::: [5, 5, 5, [11, 1]]');
    expect(getCellValue('z')).toEqual([[5], [5], [5], [[], [0, 1]]]);
  });
});
