import uuidv4 from 'uuid-v4';
import {
  getChildrenOfRef,
  getFormulaGraphs,
  getRefsById,
  getSheetsByName,
  refsAtPosition,
  refParentId,
  rewriteRefTermToParentLookup,
  transitiveChildren,
  translateExpr,
} from '../selectors/formulas/selectors';
import { copySheetContents, digMut } from '../selectors/algorithms/algorithms';
import {
  parseFormula,
  translateLookups,
} from '../selectors/formulas/parser';
import { idealWidthAndHeight } from '../selectors/geom/dragGeom';
import defaultCellName from '../selectors/formulas/defaultCellName';
import { scheduleSave } from './backend';

import {
  path,
  ARRAY,
  ARRAY_CELL,
  CELL,
  OBJECT,
  OBJECT_CELL,
  SHEET,
  TABLE,
  TABLE_CELL,
  COMPUTED_TABLE_COLUMN,
  TABLE_COLUMN,
  TABLE_ROW,
  TABLE_COLUMN_TYPES,
} from './stateConstants';

import store from './store';

const DEFAULT_FORMULA = { value: '' };

export const createSheet = () => ({ type: 'CREATE_SHEET' });

export const setFormula = (selection, formula) => ({
  type: 'SET_CELL_FORMULA',
  payload: { selection, formulaStr: formula },
});

export const deleteThing = refId => ({
  type: 'DELETE_THING',
  payload: { refId },
});

export const deleteLoc = (contextId, typeToDelete, indexToDelete) => ({
  type: 'DELETE_LOCATION',
  payload: { contextId, typeToDelete, indexToDelete },
});

// Maybe deal with re-parenting and re-typing? "Cut-paste from table cell
// into a sheet" etc.
export const moveThing = (refId, sheetId, y, x, height, width) => ({
  type: 'MOVE_THING',
  payload: { refId, sheetId, y, x, height, width },
});

export const renameSheet = (id, name) => ({
  type: 'RENAME_SHEET', payload: { id, name },
});

export const copySheet = id => ({
  type: 'COPY_SHEET', payload: { id },
});

export const toggleMaximiseSheetElem = (dispatch, refId) => {
  const refsById = getRefsById(store.getState());
  const ref = refsById[refId];
  if (!ref || !ref.sheetId) return undefined;
  const { y, x } = ref;
  const { width, height } = (ref.width * ref.height) > 1 ?
    { width: 1, height: 1 } :
    idealWidthAndHeight(store.getState(), refId, ref.sheetId, y, x);

  return dispatch(moveThing(refId, ref.sheetId, y, x, height, width));
};

const defaultArrayCell = (contextId, index, formula = DEFAULT_FORMULA) => ({
  id: uuidv4(),
  arrayId: contextId,
  type: ARRAY_CELL,
  formula,
  index,
});

const defaultSheetElem = (contextId, y, x) => ({
  sheetId: contextId,
  id: uuidv4(),
  name: defaultCellName(y, x),
  x,
  y,
});

const defaultObject = (state, contextId, y, x) => {
  const base = defaultSheetElem(contextId, y, x);
  const { width, height } = idealWidthAndHeight(
    state,
    base.id,
    contextId,
    y,
    x,
    undefined, // maxWidth
    2, // maxHeight
  );
  return { width, height, type: OBJECT, ...base };
};

const defaultTable = (state, contextId, y, x) => {
  const base = defaultSheetElem(contextId, y, x);
  const { width, height } = idealWidthAndHeight(state, base.id, contextId, y, x);
  return { width, height, type: TABLE, ...base };
};

const defaultTableCell = (arrayId, objectId, formula = DEFAULT_FORMULA) => ({
  id: uuidv4(),
  arrayId,
  objectId,
  formula,
  type: TABLE_CELL,
});

const defaultTableColumn = (contextId, index, name = `c${index + 1}`) => ({
  id: uuidv4(),
  tableId: contextId,
  name,
  index,
  type: TABLE_COLUMN,
});

const defaultComputedTableColumn = (contextId, index, name = `c${index + 1}`) => ({
  id: uuidv4(),
  tableId: contextId,
  formula: DEFAULT_FORMULA,
  name,
  index,
  type: COMPUTED_TABLE_COLUMN,
});

const defaultTableRow = (contextId, index) => ({
  id: uuidv4(),
  tableId: contextId,
  index,
  type: TABLE_ROW,
});

const defaultObjectCell = (contextId, index, formula = DEFAULT_FORMULA, name = `f${index + 1}`) => ({
  id: uuidv4(),
  objectId: contextId,
  formula,
  index,
  name,
  type: OBJECT_CELL,
});

const defaultCell = (contextId, y, x) => ({
  ...defaultSheetElem(contextId, y, x),
  width: 1,
  height: 1,
  formula: DEFAULT_FORMULA,
  type: CELL,
});

const defaultArray = (state, contextId, y, x) => {
  const base = defaultSheetElem(contextId, y, x);
  const { width, height } = idealWidthAndHeight(
    state,
    base.id,
    contextId,
    y,
    x,
    2, // maxWidth
  );
  return { width, height, type: ARRAY, ...base };
};

const defaultSheetElemForLocation = (state, context, y, x, formula) => {
  let baseCell = defaultCell(context.id, y, x);
  let children = [];
  if (formula && formula.array) {
    if (formula.array.length > 0 && formula.array.every(t => t.object)) {
      baseCell = defaultTable(state, context.id, y, x);
      const keys = {}; // name -> new child
      formula.array.forEach(({ object }, rowIndex) => {
        const row = defaultTableRow(baseCell.id, rowIndex);
        children.push(row);
        object.forEach(({ key, value }) => {
          if (!keys[key]) {
            const numKeys = Object.keys(keys).length;
            keys[key] = defaultTableColumn(baseCell.id, numKeys, key);
            children.push(keys[key]);
          }
          children.push(defaultTableCell(keys[key].id, row.id, value));
        });
      });
    } else {
      baseCell = defaultArray(state, context.id, y, x);
      children = formula.array.map((
        (childFormula, index) => defaultArrayCell(
          baseCell.id,
          index,
          childFormula,
        )
      ));
    }
  } else if (formula && formula.object) {
    baseCell = defaultObject(state, context.id, y, x);
    children = formula.object.map((
      (childFormula, index) => defaultObjectCell(
        baseCell.id,
        index,
        childFormula.value,
        childFormula.key,
      )
    ));
  }

  return { baseCell, children };
};

const defaultTableElemForLocation = (
  context,
  y,
  x,
  locationSelected,
  formula,
  oldState,
) => {
  if (!locationSelected) {
    const tableRefsAtPosition = refsAtPosition(oldState)[context.id];
    const children = [];
    let array = tableRefsAtPosition.columns[x];
    if (!array) {
      const col = defaultTableColumn(context.id, x);
      children.push(col);
      array = col;
    }
    let object = tableRefsAtPosition.rows[y];
    if (!object) {
      const row = defaultTableRow(context.id, y);
      children.push(row);
      object = row;
    }
    const baseCell = defaultTableCell(array.id, object.id);
    return { baseCell, children };
  }
  if (locationSelected.type === TABLE_COLUMN) {
    const baseCell = formula ?
      defaultComputedTableColumn(context.id, locationSelected.index) :
      defaultTableColumn(context.id, locationSelected.index);

    return { baseCell, children: [] };
  }
  if (locationSelected.type !== TABLE_ROW) {
    throw new Error('Unknown locationSelected type');
  }
  return {
    baseCell: defaultTableRow(context.id, locationSelected.index),
    children: [],
  };
};

const defaultCellForLocation = (
  context,
  y,
  x,
  locationSelected,
  formula,
  oldState,
) => {
  if (context.type === SHEET) {
    return defaultSheetElemForLocation(oldState, context, y, x, formula);
  }
  if (context.type === TABLE) {
    return defaultTableElemForLocation(
      context,
      y,
      x,
      locationSelected,
      formula,
      oldState,
    );
  }
  if (context.type === OBJECT) {
    return {
      baseCell: defaultObjectCell(context.id, x),
      children: [],
    };
  }
  if (context.type !== ARRAY) {
    throw new Error(`Unknown context type ${context.type}`);
  }
  return {
    baseCell: defaultArrayCell(context.id, y),
    children: [],
  };
};

const newSheet = (oldState) => {
  const sheetsByName = getSheetsByName(oldState);
  for (let i = 1; ; ++i) {
    const maybeName = `s${i}`;
    if (!sheetsByName[maybeName]) {
      return {
        id: uuidv4(),
        name: maybeName,
        type: SHEET,
      };
    }
  }
};

const translateTermForDeletions = (oldState, deletedRefIds) => {
  const refsById = getRefsById(oldState);
  return (
    (term) => {
      const outer = { on: term };
      let inner = outer;
      while (deletedRefIds.has(inner.on.ref)) {
        const ref = refsById[inner.on.ref];
        if (ref.type === SHEET) {
          inner.on = { name: ref.name };
          break;
        }
        inner.on = rewriteRefTermToParentLookup(refsById, inner.on);
        inner = inner.on;
      }
      return outer.on;
    }
  );
};


const translateDeletions = (oldState, newState, deletedRefIds) => {
  const { backwardsGraph } = getFormulaGraphs(oldState);
  const refsById = getRefsById(oldState);
  const deletedRefsArr = Array.from(deletedRefIds);
  const refIdsToRewrite = new Set([].concat(...deletedRefsArr.map(id => (
    backwardsGraph[id].filter(predId => refsById[predId].formula)
  ))));

  return digMut(newState, path('cells'), cells => (
    cells.map((cell) => {
      if (!refIdsToRewrite.has(cell.id)) return cell;
      return {
        ...cell,
        formula: translateExpr(
          cell.formula,
          undefined,
          translateTermForDeletions(oldState, deletedRefIds),
        ),
      };
    })
  ));
};

const rewireFormula = (cell, translateFn) => {
  const { formula } = cell;
  if (!formula) return cell;

  const translatedFormula = translateExpr(
    formula,
    undefined,
    translateFn,
  );
  return { ...cell, formula: translatedFormula };
};

const rewireBadRefs = (newState, updatedRefs) => {
  const translateFn = translateLookups(updatedRefs);
  return digMut(newState, path('cells'), cells => (
    cells.map(cell => rewireFormula(cell, translateFn))));
};

export const documentReducer = (state, action) => {
  if (action.type === 'CREATE_SHEET') {
    // Re-wire? Dunno...
    return scheduleSave((
      digMut(state, path('sheets'), sheets => [
        ...sheets,
        newSheet(state),
      ])
    ));
  }

  if (action.type === 'SET_CELL_FORMULA') {
    const { selection, formulaStr } = action.payload;
    const newFormula = parseFormula(formulaStr, selection.context, state);

    const contextRef = getRefsById(state)[selection.context];

    const { baseCell, children } = selection.cellId ?
      {
        baseCell: state.openDocument.data.cells
          .find(({ id }) => id === selection.cellId),
        children: [],
      } :
      defaultCellForLocation(
        contextRef,
        selection.y,
        selection.x,
        selection.locationSelected,
        newFormula.formula,
        state,
      );

    if (!baseCell.name) {
      delete newFormula.name;
    }
    if (!baseCell.formula) {
      delete newFormula.formula;
    }

    if (!newFormula.name && !newFormula.formula && selection.cellId) {
      // Formula is like `name: formula`.
      // When name or formula is blank and we have an existing cell, we use
      // the existing value.
      // When both are blank (i.e., the formula is `:`) we should leave
      // the cell alone.
      // When one is blank but there's no cell there, we can use a default
      // value. Don't put a default cell for the `:` formula though.
      return state;
    }

    const cell = {
      ...baseCell,
      ...newFormula,
    };

    const stateWithCell = digMut(state, path('cells'), cells => [
      ...cells.filter(({ id }) => id !== selection.cellId),
      cell,
      ...children,
    ]);
    return scheduleSave((
      rewireBadRefs(stateWithCell, [cell, ...children])
    ));
  }

  if (action.type === 'DELETE_THING') {
    const { refId } = action.payload;
    const existingRef = getRefsById(state)[refId];
    if (!existingRef) return state;

    const idsToDelete = transitiveChildren(state, refId);

    let stateMinusDeletions = digMut(state, path('data'), data => ({
      ...data,
      sheets: data.sheets.filter(({ id }) => !idsToDelete.has(id)),
      cells: data.cells.filter(({ id }) => !idsToDelete.has(id)),
    }));
    if (!stateMinusDeletions.openDocument.data.sheets.length) {
      // Don't let any documents not have any sheets.
      const sheets = [newSheet(stateMinusDeletions)];
      stateMinusDeletions = digMut(
        stateMinusDeletions,
        path('sheets'),
        sheets,
      );
    }
    return scheduleSave((
      translateDeletions(state, stateMinusDeletions, idsToDelete)
    ));
  }

  if (action.type === 'DELETE_LOCATION') {
    const { contextId, typeToDelete, indexToDelete } = action.payload;
    const context = getRefsById(state)[contextId];
    if (!context) return state;
    if (![ARRAY, OBJECT, TABLE].includes(context.type)) return state;

    const refToDelete = getChildrenOfRef(state, contextId)
      .find(({ type, index }) => index === indexToDelete && type === typeToDelete);
    const idsToDelete = refToDelete ?
      transitiveChildren(state, refToDelete.id) :
      new Set();

    const stateMinusDeletions = digMut(state, path('data'), data => ({
      ...data,
      sheets: data.sheets.filter(({ id }) => !idsToDelete.has(id)),
      cells: data.cells.filter(({ id }) => !idsToDelete.has(id))
        .map((cell) => {
          const typesToDelete = (TABLE_COLUMN_TYPES.includes(cell.type)) ?
            TABLE_COLUMN_TYPES : [cell.type];
          if (!typesToDelete.includes(cell.type)) return cell;
          if (refParentId(cell) !== contextId) return cell;
          if (cell.index < indexToDelete) return cell;
          return { ...cell, index: cell.index - 1 };
        }),
    }));
    return scheduleSave((
      translateDeletions(state, stateMinusDeletions, idsToDelete)
    ));
  }

  if (action.type === 'MOVE_THING') {
    const { refId, ...newGeometry } = action.payload;
    const existingRef = getRefsById(state)[refId];
    if (!existingRef) return state;
    if (!existingRef.sheetId) {
      throw new Error('Can only move/resize things in sheets');
    }

    return scheduleSave(digMut(state, path('cells'), cells => [
      ...cells.filter(({ id }) => id !== refId),
      { ...existingRef, ...newGeometry },
    ]));
  }

  if (action.type === 'RENAME_SHEET') {
    const { id, name } = action.payload;
    const refsById = getRefsById(store.getState());
    const ref = refsById[id];
    if (!ref || ref.type !== SHEET || ref.name === name) return state;

    const updated = { ...ref, name };
    const newState = digMut(
      state,
      path('sheets'),
      sheets => sheets.map(sheet => (sheet.id === id ? updated : sheet)),
    );
    return scheduleSave((
      rewireBadRefs(newState, [updated])
    ));
  }

  if (action.type === 'COPY_SHEET') {
    const { id } = action.payload;
    const refsById = getRefsById(store.getState());
    const ref = refsById[id];
    if (!ref || ref.type !== SHEET) return state;
    const newThings = copySheetContents(id, state);
    const newState = digMut(state, path('data'), data => ({
      ...data,
      cells: [...data.cells, ...newThings.slice(1)],
      sheets: [...data.sheets, newThings[0]],
    }));
    const sheetId = newThings[0].id;
    const viewState = digMut(newState, ['uistate', 'sheetId'], sheetId);

    return scheduleSave((
      rewireBadRefs(viewState, newThings)
    ));
  }

  return state;
};
