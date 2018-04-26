import { createStore } from 'redux';
import uuidv4 from 'uuid-v4';
import {
  getRefsById,
  flattenExpr,
  translateExpr,
} from '../selectors/formulas/selectors';
import { parseFormula } from '../selectors/formulas/parser';
import defaultCellName from '../selectors/formulas/defaultCellName';

export const SHEET = 'sheet';
export const CELL = 'cell';
export const ARRAY = 'array';
export const ARRAY_CELL = 'array_cell';


export const selectionsEqual = (sel1, sel2) => {
  if (!sel1 && !sel2) return true;
  if (!sel1 !== !sel2) return false;
  if (sel1.cellId) return sel1.cellId === sel2.cellId;
  const { y, x, context } = sel1;
  return y === sel2.y && x === sel2.x && context === sel2.context;
};


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
  cells: [],
};

export const setFormula = (selection, formula) => ({
  type: 'SET_CELL_FORMULA',
  payload: { selection, formulaStr: formula },
});

export const deleteCell = cellId => ({
  type: 'DELETE_CELL',
  payload: { cellId },
});

export const loadFile = () => ({ type: 'LOAD_FILE' });

const defaultCellForLocation = (context, y, x) => ({
  sheetId: context,
  id: uuidv4(),
  name: defaultCellName(y, x),
  formula: [{ value: '' }],
  x,
  y,
  width: 1,
  height: 1,
  type: CELL,
});

const scheduleSave = () => {
  const updateId = uuidv4();

  setTimeout(() => {
    const state = store.getState();
    if (store.getState().updateId === updateId) {
      localStorage.setItem('onlyFile', JSON.stringify(state));
    }
  }, 1000);

  return updateId;
};

const rootReducer = (state, action) => {
  if (action.type === 'SET_CELL_FORMULA') {
    const { selection, formulaStr } = action.payload;
    const newFormula = parseFormula(formulaStr, selection.context);

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

    const baseCell = selection.cellId ?
      state.cells.find(({ id }) => id === selection.cellId) :
      defaultCellForLocation(selection.context, selection.y, selection.x);
    const cell = {
      ...baseCell,
      ...newFormula,
    };

    const rewireBadRefs = (otherCell) => {
      if (!otherCell.formula) return otherCell;
      let somethingDifferent = false;
      const translatedFormula = translateExpr(
        otherCell.formula,
        otherCell.sheetId,
        (term, termSheetId) => {
          // ref is `sheetId.cellName`
          if (
            term.lookup &&
            term.on.ref === cell.sheetId &&
            term.lookup === cell.name
          ) {
            somethingDifferent = true;
            return { ref: cell.id };
          }
          // ref is `cellName` for a cell in the same sheet
          if (
            cell.sheetId === termSheetId &&
            term.name &&
            term.name === cell.name
          ) {
            somethingDifferent = true;
            return { ref: cell.id };
          }
          return term;
        },
      );
      if (!somethingDifferent) return otherCell;
      return { ...otherCell, formula: translatedFormula };
    };

    return {
      ...state,
      cells: [
        ...state.cells.filter(({ id }) => id !== selection.cellId).map(rewireBadRefs),
        cell,
      ],
      updateId: scheduleSave(),
    };
  }

  if (action.type === 'DELETE_CELL') {
    // We're going to reset everything here. In the future we will want to
    // be less destructive. That is to say, if a cell is not referred to
    // in a sheet, don't modify that sheet.
    // I think "in the future" we will have a lot of state to keep track
    // of :-/
    const { cellId } = action.payload;
    const existingCell = getRefsById(state)[cellId];
    if (!existingCell) return state;

    const translateFormula = (cell) => {
      if (!cell.formula) return cell;
      if (!flattenExpr(cell.formula).some(({ ref }) => ref === cellId)) {
        return cell;
      }
      return {
        ...cell,
        formula: translateExpr(cell.formula, cell.sheetId, (term, sheetId) => {
          if (term.ref !== cellId) return term;
          if (existingCell.sheetId === sheetId) {
            return { name: existingCell.name };
          }
          return {
            lookup: existingCell.name,
            on: { ref: existingCell.sheetId },
          };
        }),
      };
    };

    return {
      ...state,
      cells: state.cells.filter(({ id }) => id !== cellId).map(translateFormula),
      updateId: scheduleSave(),
    };
  }

  if (action.type === 'LOAD_FILE') {
    return JSON.parse(localStorage.getItem('onlyFile'));
  }

  return state;
};

const store = createStore(rootReducer, initialState);
export default store;
