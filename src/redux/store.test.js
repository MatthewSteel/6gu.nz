import store, { deleteCell, setFormula } from './store';
import { getCells, getSheets, getCellValuesById } from '../selectors/formulas/selectors';
import { stringFormula } from '../selectors/formulas/parser';

const getCellValue = cell => getCellValuesById(store.getState())[cell.id];

describe('actions/the store', () => {
  beforeEach(() => {
    getCells(store.getState()).forEach((cell) => {
      store.dispatch(deleteCell(cell.id));
    });
  });

  it('sets up simple cells and calculates their values ok', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula(sheet.id, '1,0', 'x=12'));
    const cells = getCells(store.getState());
    expect(cells.length).toBe(1);
    expect({ ...cells[0], id: undefined }).toEqual({
      sheetId: sheet.id,
      name: 'x',
      formula: [{ value: 12 }],
      x: 0,
      y: 1,
      width: 1,
      height: 1,
    });
    expect(stringFormula(cells[0].id)).toBe('x = 12');

    // test changing the name
    store.dispatch(setFormula(sheet.id, cells[0].id, 'y='));
    const newCells = getCells(store.getState());
    expect(newCells.length).toBe(1);
    expect(newCells[0].name).toBe('y');
    expect({ ...newCells[0], name: 'x' }).toEqual(cells[0]);

    expect(getCellValue(cells[0])).toEqual({
      value: 12,
      override: false,
    });
    expect(stringFormula(cells[0].id)).toBe('y = 12');

    store.dispatch(setFormula(sheet.id, '2,0', '="hi"'));
    const newCell = getCells(store.getState()).find(({ y }) => y === 2);
    expect(newCell.name).toBe('a3');
    expect(stringFormula(newCell.id)).toBe('a3 = "hi"');
  });

  it('handles cross-sheet formulas', () => {
    const [sheet1, sheet2] = getSheets(store.getState());
    const s1Name = sheet1.name;
    store.dispatch(setFormula(sheet1.id, '1,0', 'x=12'));
    store.dispatch(setFormula(sheet1.id, '2,0', 'y=x'));
    store.dispatch(setFormula(sheet2.id, '3,0', `x=${s1Name}.y(x=10)`));

    const x2 = getCells(store.getState()).find(({ y }) => y === 3);
    expect(getCellValue(x2)).toEqual({
      value: 10,
      override: false,
    });
    expect(stringFormula(x2.id)).toBe(`x = ${s1Name}.y(x=10)`);
  });

  it('handles deletions and re-wiring', () => {
    const [sheet1, sheet2] = getSheets(store.getState());
    const s1Name = sheet1.name;
    store.dispatch(setFormula(sheet1.id, '1,0', 'x=12'));
    store.dispatch(setFormula(sheet1.id, '2,0', 'y=x'));
    store.dispatch(setFormula(sheet2.id, '3,0', `x=${s1Name}.y(x=10)`));

    const x1 = getCells(store.getState()).find(({ y }) => y === 1);
    store.dispatch(deleteCell(x1.id));

    expect(getCellValue(x1)).toBe(undefined);

    const y1 = getCells(store.getState()).find(({ y }) => y === 2);
    const x2 = getCells(store.getState()).find(({ y }) => y === 3);

    expect(stringFormula(y1.id)).toBe('y = x');
    expect(stringFormula(x2.id)).toBe(`x = ${s1Name}.y(x=10)`);

    expect(getCellValue(y1)).toEqual({
      error: 'Error: x does not exist.',
    });
    expect(getCellValue(x2)).toEqual({
      error: 'Error: x does not exist.',
    });

    store.dispatch(setFormula(sheet1.id, '5,5', 'x="hello"'));
    expect(getCellValue(y1)).toEqual({
      value: 'hello',
      override: false,
    });
    expect(getCellValue(x2)).toEqual({
      value: 10,
      override: false,
    });

    expect(stringFormula(y1.id)).toBe('y = x');
    expect(stringFormula(x2.id)).toBe(`x = ${s1Name}.y(x=10)`);
  });
});

