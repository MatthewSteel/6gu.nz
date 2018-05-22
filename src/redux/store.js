import { createStore } from 'redux';
import uuidv4 from 'uuid-v4';
import equal from 'fast-deep-equal';
import {
  getContextIdForRefId,
  getFormulaGraphs,
  getRefsById,
  getSheetsByName,
  getRefsByNameForContextId,
  rewriteRefTermToParentLookup,
  transitiveChildren,
  translateExpr,
} from '../selectors/formulas/selectors';
import {
  parseFormula,
  translateLookups,
} from '../selectors/formulas/parser';
import { DRAG_RESIZE } from '../selectors/geom/dragGeom';
import defaultCellName from '../selectors/formulas/defaultCellName';

export const SHEET = 'sheet';
export const CELL = 'cell';
export const ARRAY = 'array';
export const ARRAY_CELL = 'array_cell';


const initialState = {
  sheets: [{
    id: 'sheet0',
    name: 's1',
    type: SHEET,
  }, {
    id: 'sheet1',
    name: 's2',
    type: SHEET,
  }],
  cells: [{
    id: 'arr',
    name: 'arr',
    type: ARRAY,
    sheetId: 'sheet0',
    x: 1,
    y: 1,
    width: 2,
    height: 2,
  }],
  uistate: { dragState: {} },
};

export const createSheet = () => ({ type: 'CREATE_SHEET' });

export const setFormula = (selection, formula) => ({
  type: 'SET_CELL_FORMULA',
  payload: { selection, formulaStr: formula },
});

export const deleteThing = refId => ({
  type: 'DELETE_THING',
  payload: { refId },
});

export const deleteLoc = (contextId, y, x) => ({
  type: 'DELETE_LOCATION',
  payload: { contextId, y, x },
});

// Maybe deal with re-parenting and re-typing? "Cut-paste from table cell
// into a sheet" etc.
export const moveThing = (refId, sheetId, y, x, height, width) => ({
  type: 'MOVE_THING',
  payload: { refId, sheetId, y, x, height, width },
});

export const startDrag = (sourceViewId, refId, type) => ({
  type: 'START_DRAG',
  payload: { sourceViewId, refId, type },
});

export const updateDrag = (targetViewId, targetSheetId, y, x) => ({
  type: 'UPDATE_DRAG',
  payload: { targetViewId, targetSheetId, y, x },
});

export const clearDrag = () => ({ type: 'CLEAR_DRAG' });

export const loadFile = () => ({ type: 'LOAD_FILE' });

const defaultCellForLocation = (context, y, x) => {
  if (context.type === SHEET) {
    return {
      sheetId: context.id,
      id: uuidv4(),
      name: defaultCellName(y, x),
      formula: { value: '' },
      x,
      y,
      width: 1,
      height: 1,
      type: CELL,
    };
  }
  if (context.type !== ARRAY) {
    throw new Error(`Unknown context type ${context.type}`);
  }
  return {
    id: uuidv4(),
    arrayId: context.id,
    type: ARRAY_CELL,
    formula: { value: '' },
    index: y,
  };
};

const scheduleSave = () => {
  const updateId = uuidv4();

  setTimeout(() => {
    const { sheets, cells } = store.getState();
    if (store.getState().updateId === updateId) {
      localStorage.setItem('onlyFile', JSON.stringify({ sheets, cells }));
    }
  }, 1000);

  return updateId;
};

const newSheet = () => {
  const sheetsByName = getSheetsByName(store.getState());
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

const translateTermForDeletions = (deletedRefIds) => {
  const refsById = getRefsById(store.getState());
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
        inner.on = rewriteRefTermToParentLookup(inner.on);
        inner = inner.on;
      }
      return outer.on;
    }
  );
};


const translateDeletions = (newState, deletedRefIds) => {
  const { backwardsGraph } = getFormulaGraphs(store.getState());
  const refsById = getRefsById(store.getState());
  const deletedRefsArr = Array.from(deletedRefIds);
  const refIdsToRewrite = new Set([].concat(...deletedRefsArr.map(id => (
    backwardsGraph[id].filter(predId => refsById[predId].formula)
  ))));

  return {
    ...newState,
    cells: newState.cells.map((cell) => {
      if (!refIdsToRewrite.has(cell.id)) return cell;
      return {
        ...cell,
        formula: translateExpr(cell.formula, undefined, translateTermForDeletions(deletedRefIds)),
      };
    }),
  };
};

const rewireFormula = (cell, updatedRef) => {
  const { formula } = cell;
  if (!formula) return cell;

  const contextId = getContextIdForRefId(cell.id);
  const translatedFormula = translateExpr(
    formula,
    contextId,
    translateLookups(updatedRef),
  );
  return { ...cell, formula: translatedFormula };
};

const rewireBadRefs = (newState, updatedRef) => ({
  ...newState,
  cells: newState.cells.map(cell => rewireFormula(cell, updatedRef)),
});

const rootReducer = (state, action) => {
  if (action.type === 'LOAD_FILE') {
    return {
      uistate: { dragState: {} },
      ...JSON.parse(localStorage.getItem('onlyFile')),
    };
  }

  if (action.type === 'CREATE_SHEET') {
    // Re-wire? Dunno...
    return {
      ...state,
      sheets: [...state.sheets, newSheet()],
      updateId: scheduleSave(),
    };
  }

  if (action.type === 'SET_CELL_FORMULA') {
    const { selection, formulaStr } = action.payload;
    const newFormula = parseFormula(formulaStr, selection.context);

    const contextRef = getRefsById(store.getState())[selection.context];
    if (contextRef.type !== SHEET) delete newFormula.name;

    const baseCell = selection.cellId ?
      state.cells.find(({ id }) => id === selection.cellId) :
      defaultCellForLocation(contextRef, selection.y, selection.x);

    if (baseCell && ![CELL, ARRAY_CELL].includes(baseCell.type)) {
      delete newFormula.formula;
    }

    if (!newFormula.name && !newFormula.formula) {
      // Formula is like `name=formula`.
      // When one is blank and we have an existing cell, we use the
      // existing value.
      // When both are blank (i.e., the formula is `=`) we should leave
      // the cell alone.
      // When one is blank but there's no cell there, we can use a default
      // value. Don't put a default cell for the `=` formula though.
      return state;
    }

    const cell = {
      ...baseCell,
      ...newFormula,
    };

    const stateWithCell = {
      ...state,
      cells: [
        ...state.cells.filter(({ id }) => id !== selection.cellId),
        cell,
      ],
      updateId: scheduleSave(),
    };
    return rewireBadRefs(stateWithCell, cell);
  }

  if (action.type === 'DELETE_THING') {
    const { refId } = action.payload;
    const existingRef = getRefsById(state)[refId];
    if (!existingRef) return state;

    const idsToDelete = transitiveChildren(refId);

    const stateMinusDeletions = {
      ...state,
      sheets: state.sheets.filter(({ id }) => !idsToDelete.has(id)),
      cells: state.cells.filter(({ id }) => !idsToDelete.has(id)),
      updateId: scheduleSave(),
    };
    return translateDeletions(stateMinusDeletions, idsToDelete);
  }

  if (action.type === 'DELETE_LOCATION') {
    const { contextId, y } = action.payload;
    const context = getRefsById(state)[contextId];
    if (!context) return state;
    if (!context.type === ARRAY) return state;

    const refToDelete = getRefsByNameForContextId(state, contextId)[y];
    const idsToDelete = refToDelete ?
      transitiveChildren(refToDelete.id) :
      new Set();

    const stateMinusDeletions = {
      ...state,
      sheets: state.sheets.filter(({ id }) => !idsToDelete.has(id)),
      cells: state.cells
        .filter(({ id }) => !idsToDelete.has(id))
        .map((cell) => {
          if (cell.arrayId !== contextId || cell.index < y) return cell;
          return { ...cell, index: cell.index - 1 };
        }),
      updateId: scheduleSave(),
    };
    return translateDeletions(stateMinusDeletions, idsToDelete);
  }

  if (action.type === 'MOVE_THING') {
    const { refId, ...newGeometry } = action.payload;
    const existingRef = getRefsById(state)[refId];
    if (!existingRef) return state;
    if (!existingRef.sheetId) {
      throw new Error('Can only move/resize things in sheets');
    }

    return {
      ...state,
      cells: [
        ...state.cells.filter(({ id }) => id !== refId),
        { ...existingRef, ...newGeometry },
      ],
      updateId: scheduleSave(),
    };
  }

  if (action.type === 'START_DRAG') {
    return {
      ...state,
      uistate: { ...state.uistate, dragState: action.payload },
    };
  }

  if (action.type === 'UPDATE_DRAG') {
    const { targetViewId } = action.payload;
    const { sourceViewId, type } = state.uistate.dragState;
    if (type === DRAG_RESIZE && sourceViewId !== targetViewId) {
      return state;
    }
    const { dragState } = state.uistate;
    const newDragState = { ...dragState, ...action.payload };
    if (equal(dragState, newDragState)) {
      return state;
    }
    return {
      ...state,
      uistate: {
        ...state.uistate,
        dragState: newDragState,
      },
    };
  }

  if (action.type === 'CLEAR_DRAG') {
    return {
      ...state,
      uistate: { ...state.uistate, dragState: {} },
    };
  }

  return state;
};

const store = createStore(rootReducer, initialState);
export default store;
