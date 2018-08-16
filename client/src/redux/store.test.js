import store from './store';
import { ARRAY, CELL, OBJECT, TABLE, TABLE_CELL, TABLE_COLUMN, TABLE_ROW, LOGIN_STATES } from './stateConstants';
import { deleteLoc, deleteThing, setFormula, updateForeignKey } from './documentEditing';
import { getCells, getSheets } from '../selectors/formulas/selectors';
import { getCellValuesById } from '../selectors/formulas/codegen';
import { stringFormula } from '../selectors/formulas/unparser';
import { blankDocument } from './backend';
import { toRaw1 } from '../selectors/formulas/builtins';

const allCells = () => getCells(store.getState());
const find = f => allCells().find(f);
const getCellValue = cell => getCellValuesById(store.getState())[cell.id];
const rawValue = cell => toRaw1(getCellValue(cell).value);
const getStr = id => stringFormula(store.getState(), id);

describe('actions/the store', () => {
  beforeEach(() => {
    store.dispatch({
      type: 'USER_STATE',
      payload: {
        userState: { loginState: LOGIN_STATES.LOGGED_IN, documents: [] },
        openDocument: blankDocument(),
      },
    });
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
    expect(getStr(cells[0].id)).toBe('x: 12');

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
    expect(getStr(cells[0].id)).toBe('y: 12');

    store.dispatch(setFormula({ context: sheet.id, y: 2, x: 0 }, ':"hi"'));
    const newCell = find(({ y }) => y === 2);
    expect(newCell.name).toBe('a3');
    expect(getStr(newCell.id)).toBe('a3: "hi"');
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
    expect(getStr(x2.id)).toBe(`x: ${s1Name}.y(x: 10)`);

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
    expect(getStr(y1.id)).toBe('y: s1.x');
    expect(getStr(x2.id)).toBe(`x: ${s1Name}.y(${s1Name}.x: 10)`);

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

    expect(getStr(y1.id)).toBe('y: x');
    expect(getStr(x2.id)).toBe(`x: ${s1Name}.y(x: 10)`);
  });

  it('deletes sheets ok', () => {
    const [sheet1, sheet2] = getSheets(store.getState());
    store.dispatch(setFormula({ context: sheet1.id, y: 1, x: 0 }, '0'));
    store.dispatch(setFormula({ context: sheet2.id, y: 2, x: 0 }, '1'));
    store.dispatch(setFormula({ context: sheet1.id, y: 5, x: 5 }, 'x:1'));

    store.dispatch(deleteThing(sheet1.id));
    store.dispatch(deleteThing(sheet2.id));
    expect(allCells()).toEqual([]);

    // Never allow no sheets
    expect(getSheets(store.getState()).length).toEqual(1);
    const sheetId = getSheets(store.getState())[0].id;
    expect(sheetId).not.toBe(sheet1.id);
    expect(sheetId).not.toBe(sheet2.id);
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
      'y: sin("arg")',
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
    expect(getCellValue(x).value).toBe(1);
    const y = find(({ name }) => name === 'y');
    expect(y.formula).toEqual({
      call: { name: 'sin' },
      args: [{ value: 'arg' }],
      kwargs: [],
    });
    const z = find(({ name }) => name === 'z');
    expect(z.formula).toEqual({ badFormula: 'notAFunction(degrees: 0)' });

    store.dispatch(setFormula(
      { context: sheet.id, y: 1, x: 0 },
      'w: sin',
    ));
    const w = find(({ name }) => name === 'w');
    expect(w.formula).toEqual({ name: 'sin' });
    expect(getCellValue(w)).toEqual({
      error: 'Error: sin does not exist',
      override: false,
    });
  });

  it('builds complex objects', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula(
      { context: sheet.id, y: 10, x: 10 },
      'x: []',
    ));
    store.dispatch(setFormula(
      { context: sheet.id, y: 5, x: 5 },
      'y: {}',
    ));
    store.dispatch(setFormula(
      { context: sheet.id, y: 0, x: 0 },
      'z: [{}]',
    ));
    store.dispatch(setFormula(
      { context: sheet.id, y: 5, x: 3 },
      'w: [{}]',
    ));

    expect(find(({ name }) => name === 'x').type).toBe(ARRAY);
    expect(find(({ name }) => name === 'y').type).toBe(OBJECT);
    const z = find(({ name }) => name === 'z');
    expect(z.type).toBe(TABLE);
    expect(z.width).toBe(3);
    expect(z.height).toBe(4);

    const w = find(({ name }) => name === 'w');
    expect(w.width).toBe(2); // does not cover y
    expect(w.height).toBe(4);
  });

  it('cleans up when we delete complex objects', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula(
      { context: sheet.id, y: 0, x: 0 },
      'fred: [{a: 10, b: 20}, { a: "hi", b: 22 }]',
    ));
    const cells = getCells(store.getState());
    expect(cells.map(({ type }) => type).sort()).toEqual([
      TABLE,
      TABLE_CELL, TABLE_CELL, TABLE_CELL, TABLE_CELL,
      TABLE_COLUMN, TABLE_COLUMN,
      TABLE_ROW, TABLE_ROW,
    ]);

    const table = find(({ name }) => name === 'fred');
    store.dispatch(deleteLoc(table.id, TABLE_ROW, 1));
    const cells2 = getCells(store.getState());
    expect(cells2.map(({ type }) => type).sort()).toEqual([
      TABLE,
      TABLE_CELL, TABLE_CELL,
      TABLE_COLUMN, TABLE_COLUMN,
      TABLE_ROW,
    ]);

    // "dummy row" delete
    const numCellsBefore = getCells(store.getState()).length;
    store.dispatch(deleteLoc(table.id, TABLE_ROW, 1));
    const numCellsAfter = getCells(store.getState()).length;
    expect(numCellsBefore).toBe(numCellsAfter);

    // Delete everything, should clean up orphaned children
    store.dispatch(deleteThing(table.id));
    expect(getCells(store.getState())).toEqual([]);
  });

  it('bad refs do not kill the app when we break calls', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula({ context: sheet.id, y: 0, x: 0 }, 'x: 0'));
    store.dispatch(setFormula({ context: sheet.id, y: 0, x: 0 }, 'i: x + 1'));
    store.dispatch(setFormula({ context: sheet.id, y: 0, x: 0 }, 'j: i(x: 1)'));

    const j = find(({ name }) => name === 'j');
    expect(getCellValue(j)).toEqual({
      value: 2,
      override: false,
    });

    const i = find(({ name }) => name === 'i');
    store.dispatch(deleteThing(i.id));

    const newJ = find(({ name }) => name === 'j');
    expect(getCellValue(newJ)).toEqual({
      error: 'Error: i does not exist.',
      override: false,
    });
  });

  it('is forgiving about bad names in cells', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula({ context: sheet.id, y: 0, x: 0 }, 't: [{}]'));
    const table = find(({ name }) => name === 't');
    store.dispatch(setFormula(
      {
        context: table.id,
        y: 0,
        x: 0,
        locationSelected: { index: 0, type: TABLE_COLUMN },
      },
      'x',
    ));
    // Makes a column with that name.
    const column = find(({ name }) => name === 'x');
    expect(column.type).toBe(TABLE_COLUMN);
    store.dispatch(setFormula({ context: table.id, y: 0, x: 0 }, 'y'));

    const yByName = find(({ name }) => name === 'y');
    expect(yByName).toBe(undefined); // nothing by that name

    const tableCell = find(({ type }) => type === TABLE_CELL);
    expect(tableCell.formula).toEqual({ value: 'y' });
  });

  describe('with foreign keys', () => {
    beforeEach(() => {
      const [sheet] = getSheets(store.getState());
      store.dispatch(setFormula(
        { context: sheet.id, y: 0, x: 0 },
        'pkTable: [{id: 1, value: "a"}, {id: 2, value: "ba"}]',
      ));
      store.dispatch(setFormula(
        { context: sheet.id, y: 5, x: 0 },
        'fkTable: [{p: 2}, {p: 2}, {p: 1}]',
      ));
      const fkCol = find(({ name }) => name === 'p');
      store.dispatch(updateForeignKey(fkCol.id, 'pkTable.id'));
    });

    it('parses a simple arrow formula appropriately', () => {
      const [sheet] = getSheets(store.getState());
      const xFormula = 'x: fkTable.p->pkTable.value';
      store.dispatch(setFormula(
        { context: sheet.id, y: 0, x: 5 }, xFormula,
      ));
      const x = find(({ name }) => name === 'x');
      expect(rawValue(x)).toEqual(['ba', 'ba', 'a']);
      expect(getStr(x.id)).toBe(xFormula);
    });

    it('parses a row-lookup arrow formula', () => {
      const [sheet] = getSheets(store.getState());
      const xFormula = 'x: fkTable[1].p->pkTable';
      store.dispatch(setFormula(
        { context: sheet.id, y: 0, x: 5 }, xFormula,
      ));
      const x = find(({ name }) => name === 'x');
      expect(rawValue(x)).toEqual({ value: 'ba', id: 2 });
      expect(getStr(x.id)).toBe(xFormula);
    });

    it('parses arrow-after-arrow', () => {
      const [sheet] = getSheets(store.getState());
      // Set up a table referred to by pkTable.id
      store.dispatch(setFormula(
        { context: sheet.id, y: 0, x: 5 },
        'pkTable2: [{id2: "ba", v:6}, {id2: "a", v: 7}]',
      ));
      // Set up a foreign key relation
      const fkCol2 = find(({ name }) => name === 'value');
      store.dispatch(updateForeignKey(fkCol2.id, 'pkTable2.id2'));

      // Test the foreign key relation
      const xFormula = 'x: fkTable.p->pkTable.value->pkTable2.v';
      store.dispatch(setFormula(
        { context: sheet.id, y: 0, x: 10 }, xFormula,
      ));
      const x = find(({ name }) => name === 'x');
      expect(rawValue(x)).toEqual([6, 6, 7]);
      expect(getStr(x.id)).toBe(xFormula);
    });

    it('is conservative about column dependencies', () => {
      const [sheet] = getSheets(store.getState());
      // pkTable is [{id: 1, value: "a"}, {id: 2, value: "ba"}]
      store.dispatch(setFormula(
        { context: sheet.id, y: 0, x: 5 },
        'pkTable2: [{id2: "ba", fk:1, val: 7}, {id2: "a", fk: 1, val: 8}]',
      ));
      // pkTable.value refers to pkTable2.id2
      const fkCol1 = find(({ name }) => name === 'value');
      store.dispatch(updateForeignKey(fkCol1.id, 'pkTable2.id2'));

      // pkTable2.fk refers to pkTable.id
      const fkCol2 = find(({ name }) => name === 'fk');
      store.dispatch(updateForeignKey(fkCol2.id, 'pkTable.id'));

      // Try to add a computed column to each table to chase through
      // the references. Results should be ids from the same tables.
      //
      // The important thing in this test is that the translated
      // lookups only depend on the used columns. Naively translated,
      // this formula first turns into
      //   pkTable2[pkTable2.id2 :: pkTable.value]->fk.id
      // and then into
      //   pkTable[pkTable.id :: pkTable2[pkTable2.id2 :: pkTable.value].fk].id
      // and there are two with this:
      //  1. It looks like it depends on the whole pkTable (at the start), and
      //  2. It looks like it depends on the whole pkTable2 (in the middle).
      // In actual fact, though, that first lookup just uses pkTable.id,
      // and the second lookup just uses pkTable2.fk. We do some magical
      // translation to transform this formula into
      //   pkTable.id[pkTable.id :: pkTable2.fk[pkTable2.id2 :: pkTable.value]]
      const cousinsFormula = 'pkTableCousins: pkTable.value->pkTable2.fk->pkTable.id';
      const pkTable = find(({ name }) => name === 'pkTable');
      store.dispatch(setFormula(
        {
          context: pkTable.id,
          y: 0,
          x: 2,
          locationSelected: { index: 2, type: TABLE_COLUMN },
        },
        cousinsFormula,
      ));
      const cousins2Formula = 'pkTable2Cousins: pkTable2.fk->pkTable.value->pkTable2.val';
      const pkTable2 = find(({ name }) => name === 'pkTable2');
      store.dispatch(setFormula(
        {
          context: pkTable2.id,
          y: 0,
          x: 3,
          locationSelected: { index: 3, type: TABLE_COLUMN },
        },
        // Very similar thing to the above explanation happens here. Making
        // these mutual dependencies just makes triply sure the optmisation
        // happens :-).
        cousins2Formula,
      ));

      // Check out the values of these columns after both are there
      const cousins = find(({ name }) => name === 'pkTableCousins');
      expect(rawValue(cousins)).toEqual([1, 1]);
      expect(getStr(cousins.id)).toBe(cousinsFormula);

      const cousins2 = find(({ name }) => name === 'pkTable2Cousins');
      expect(rawValue(cousins2)).toEqual([8, 8]);
      expect(getStr(cousins2.id)).toBe(cousins2Formula);
    });
  });

  it('doesn\'t mess up "bad" lookups when trying to simplify arrows', () => {
    const [sheet] = getSheets(store.getState());
    store.dispatch(setFormula({ context: sheet.id, y: 0, x: 0 }, 'o: ({a: {b: "hi" }})'));
    store.dispatch(setFormula({ context: sheet.id, y: 0, x: 0 }, 'v: o.a.b'));
    store.dispatch(setFormula({ context: sheet.id, y: 0, x: 0 }, 'v2: ((o).b).a'));
    const v = find(({ name }) => name === 'v');
    expect(rawValue(v)).toEqual('hi');

    const v2 = find(({ name }) => name === 'v');
    expect(rawValue(v2)).toEqual('hi');
  });
});
