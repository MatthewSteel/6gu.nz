import store, { CELL, createSheet, deleteThing, setFormula } from './store';
import { getCells, getSheets } from '../selectors/formulas/selectors';
import { getCellValuesById } from '../selectors/formulas/codegen';
import { stringFormula } from '../selectors/formulas/unparser';

const allCells = () => getCells(store.getState());
const find = f => allCells().find(f);
const getCellValue = cell => getCellValuesById(store.getState())[cell.id];

describe('actions/the store', () => {
  beforeEach(() => {
    getSheets(store.getState()).forEach((sheet) => {
      store.dispatch(deleteThing(sheet.id));
    });
    store.dispatch(createSheet());
    store.dispatch(createSheet());
  });

  it('sets up simple cells and calculates their values ok', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula({ context: sheet.id, y: 1, x: 0 }, 'x:12'));
    const cells = allCells();
    expect(cells.length).toBe(1);
    expect({ ...cells[0], id: undefined }).toEqual({
      sheetId: sheet.id,
      name: 'x',
      formula: { value: 12 },
      x: 0,
      y: 1,
      width: 1,
      height: 1,
      type: CELL,
    });
    expect(stringFormula(cells[0].id)).toBe('x: 12');

    // test changing the name
    store.dispatch(setFormula({ context: sheet.id, cellId: cells[0].id }, 'y:'));
    const newCells = allCells();
    expect(newCells.length).toBe(1);
    expect(newCells[0].name).toBe('y');
    expect({ ...newCells[0], name: 'x' }).toEqual(cells[0]);

    expect(getCellValue(cells[0])).toEqual({
      value: 12,
      override: false,
    });
    expect(stringFormula(cells[0].id)).toBe('y: 12');

    store.dispatch(setFormula({ context: sheet.id, y: 2, x: 0 }, ':"hi"'));
    const newCell = find(({ y }) => y === 2);
    expect(newCell.name).toBe('a3');
    expect(stringFormula(newCell.id)).toBe('a3: "hi"');
  });

  it('handles cross-sheet formulas', () => {
    const [sheet1, sheet2] = getSheets(store.getState());
    const s1Name = sheet1.name;
    store.dispatch(setFormula({ context: sheet1.id, y: 1, x: 0 }, 'x:12'));
    store.dispatch(setFormula({ context: sheet1.id, y: 2, x: 0 }, 'y:x'));
    store.dispatch(setFormula({ context: sheet2.id, y: 3, x: 0 }, `x:${s1Name}.y(x: 10)`));

    const x2 = find(({ y }) => y === 3);
    expect(getCellValue(x2)).toEqual({
      value: 10,
      override: false,
    });
    expect(stringFormula(x2.id)).toBe(`x: ${s1Name}.y(x: 10)`);

    store.dispatch(setFormula({ context: sheet2.id, y: 4, x: 0 }, `y: ${s1Name}.y`));
    const y2 = find(({ y }) => y === 4);
    expect(getCellValue(y2)).toEqual({
      value: 12,
      override: false,
    });
  });

  it('handles deletions and re-wiring', () => {
    const [sheet1, sheet2] = getSheets(store.getState());
    const s1Name = sheet1.name;
    store.dispatch(setFormula({ context: sheet1.id, y: 1, x: 0 }, 'x:12'));
    store.dispatch(setFormula({ context: sheet1.id, y: 2, x: 0 }, 'y:x'));
    store.dispatch(setFormula({ context: sheet2.id, y: 3, x: 0 }, `x:${s1Name}.y(x:10)`));

    const x1 = find(({ y }) => y === 1);
    store.dispatch(deleteThing(x1.id));

    expect(getCellValue(x1)).toBe(undefined);

    const y1 = find(({ y }) => y === 2);
    const x2 = find(({ y }) => y === 3);

    // "Broken" references become lookups by name on parent refs. We end
    // up with the parent name in the cell.
    expect(stringFormula(y1.id)).toBe('y: s1.x');
    expect(stringFormula(x2.id)).toBe(`x: ${s1Name}.y(${s1Name}.x: 10)`);

    expect(getCellValue(y1)).toEqual({
      error: 'Error: x does not exist.',
      override: false,
    });
    expect(getCellValue(x2)).toEqual({
      error: 'Error: x does not exist.',
      override: false,
    });

    store.dispatch(setFormula({ context: sheet1.id, y: 5, x: 5 }, 'x:"hello"'));
    expect(getCellValue(y1)).toEqual({
      value: 'hello',
      override: false,
    });
    expect(getCellValue(x2)).toEqual({
      value: 10,
      override: false,
    });

    expect(stringFormula(y1.id)).toBe('y: x');
    expect(stringFormula(x2.id)).toBe(`x: ${s1Name}.y(x: 10)`);
  });

  it('deletes sheets ok', () => {
    const [sheet1, sheet2] = getSheets(store.getState());
    store.dispatch(setFormula({ context: sheet1.id, y: 1, x: 0 }, '0'));
    store.dispatch(setFormula({ context: sheet2.id, y: 2, x: 0 }, '1'));

    store.dispatch(deleteThing(sheet1.id));
    store.dispatch(deleteThing(sheet2.id));
    expect(allCells()).toEqual([]);
    expect(getSheets(store.getState())).toEqual([]);
  });

  it('gives us good formula errors when sheets are deleted', () => {
    const [sheet1, sheet2] = getSheets(store.getState());
    const s1Name = sheet1.name;
    store.dispatch(setFormula(
      {
        context: sheet2.id,
        y: 0,
        x: 0,
      },
      `x:${s1Name}`,
    ));
    const x = find(() => true);
    store.dispatch(deleteThing(sheet1.id));
    expect(getCellValue(x)).toEqual({ error: `Error: ${s1Name} does not exist.`, override: false });
  });

  it('does simple equality checks', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula(
      { context: sheet.id, y: 1, x: 0 },
      'x:1 = 2',
    ));
    store.dispatch(setFormula(
      { context: sheet.id, y: 2, x: 0 },
      'y:"hi" = "hi"',
    ));

    const xCell = find(({ y }) => y === 1);
    const yCell = find(({ y }) => y === 2);
    expect(getCellValue(xCell).value).toBe(false);
    expect(getCellValue(yCell).value).toBe(true);
  });

  it('parses global function calls reasonably', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula(
      { context: sheet.id, y: 1, x: 0 },
      'x: sin(degrees: 90)',
    ));
    store.dispatch(setFormula(
      { context: sheet.id, y: 2, x: 0 },
      'y: sin("arg", x: 10)',
    ));
    store.dispatch(setFormula(
      { context: sheet.id, y: 2, x: 0 },
      'z: notAFunction(degrees: 0)',
    ));

    const x = find(({ name }) => name === 'x');
    expect(x.formula).toEqual({
      call: { name: 'sin' },
      args: [],
      // args: [{ value: 'arg' }],
      kwargs: [{ ref: { name: 'degrees' }, expr: { value: 90 } }],
    });
    const y = find(({ name }) => name === 'y');
    expect(y.formula).toEqual({
      call: { name: 'sin' },
      args: [{ value: 'arg' }],
      kwargs: [{ ref: { ref: x.id }, expr: { value: 10 } }],
    });
    const z = find(({ name }) => name === 'z');
    expect(z.formula).toEqual({ badFormula: 'notAFunction(degrees: 0)' });
  });
});

