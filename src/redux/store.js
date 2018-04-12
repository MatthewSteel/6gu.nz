import { createStore } from 'redux';
import uuidv4 from 'uuid-v4';
import {
  getCellsById,
  flattenExpr,
  translateExpr,
} from '../selectors/formulas/selectors';
import { parseFormula } from '../selectors/formulas/parser';
import defaultCellName from '../selectors/formulas/defaultCellName';


const initialState = {
  sheets: [{
    id: 'sheet0',
    name: 's1',
  }, {
    id: 'sheet1',
    name: 's2',
  }],
  cells: [],
};

export const setFormula = (sheetId, cellId, formula) => ({
  type: 'SET_CELL_FORMULA',
  payload: { sheetId, cellId, formulaStr: formula },
});

export const deleteCell = cellId => ({
  type: 'DELETE_CELL',
  payload: { cellId },
});

export const loadFile = () => ({ type: 'LOAD_FILE' });

const defaultCellForLocation = (sheetId, cellId) => {
  const [y, x] = cellId.split(',').map(Number);
  return {
    sheetId,
    id: uuidv4(),
    name: defaultCellName(y, x),
    formula: [{ value: '' }],
    x,
    y,
    width: 1,
    height: 1,
  };
};

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
    const { cellId, formulaStr, sheetId } = action.payload;
    const newFormula = parseFormula(formulaStr, sheetId);

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

    const existingCell = state.cells.find(({ id }) => id === cellId);
    const cell = {
      ...(existingCell || defaultCellForLocation(sheetId, cellId)),
      ...newFormula,
    };

    const rewireBadRefs = (otherCell) => {
      let somethingDifferent = false;
      const translatedFormula = translateExpr(
        otherCell.formula,
        otherCell.sheetId,
        (term, termSheetId) => {
          if (
            cell.sheetId !== termSheetId &&
            term.ref === cell.sheetId &&
            term.lookup &&
            term.lookup.name === cell.name
          ) {
            somethingDifferent = true;
            return {
              ...term,
              name: undefined,
              lookup: undefined,
              ref: cell.id,
            };
          }
          if (
            cell.sheetId === termSheetId &&
            term.ref === cell.name
          ) {
            somethingDifferent = true;
            return { ...term, name: undefined, ref: cell.id };
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
        ...state.cells.filter(({ id }) => id !== cellId).map(rewireBadRefs),
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
    const existingCell = getCellsById(state)[cellId];
    if (!existingCell) return state;

    const translateFormula = (cell) => {
      if (!flattenExpr(cell.formula).some(({ ref }) => ref === cellId)) {
        return cell;
      }
      return {
        ...cell,
        formula: translateExpr(cell.formula, cell.sheetId, (term, sheetId) => {
          if (term.ref !== cellId) return term;
          if (existingCell.sheetId !== sheetId) {
            return {
              ref: existingCell.sheetId,
              lookup: { name: existingCell.name },
            };
          }
          return { ...term, ref: existingCell.name };
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
