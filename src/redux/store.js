import { createStore } from 'redux';
import uuidv4 from 'uuid-v4';
import {
  getCellsById,
  getTablesById,
  parseFormula,
  unparseTerm,
} from '../selectors/formulas/formulas';

const initialState = {
  tables: [{
    id: 'table0',
    name: 'table0',
    width: 6,
    height: 6,
  }, {
    id: 'table1',
    name: 'table1',
    width: 6,
    height: 6,
  }],
  cells: [{
    id: 'cell0',
    tableId: 'table0',
    name: 'Fred',
    formula: [{ value: 0 }],
    x: 0,
    y: 0,
    width: 1,
    height: 1,
  }, {
    id: 'cell1',
    tableId: 'table0',
    name: 'Sally',
    formula: [{ value: 'bar' }],
    x: 1,
    y: 0,
    width: 1,
    height: 1,
  }, {
    id: 'cell2',
    tableId: 'table0',
    name: 'Wiremu',
    formula: [{ value: 'baz' }],
    x: 0,
    y: 1,
    width: 1,
    height: 1,
  }, {
    id: 'cell3',
    tableId: 'table0',
    name: 'Tui',
    formula: [{ ref: 'cell2' }, { op: '+' }, { value: 'quux' }],
    x: 1,
    y: 1,
    width: 3,
    height: 4,
  }],
};

export const setFormula = (tableId, cellId, formula) => ({
  type: 'SET_CELL_FORMULA',
  payload: { tableId, cellId, stringFormula: formula },
});

export const deleteCell = cellId => ({
  type: 'DELETE_CELL',
  payload: { cellId },
});

const defaultCellForLocation = (tableId, cellId) => {
  const [, y, x] = cellId.split('_').map(Number);
  return {
    tableId,
    id: uuidv4(),
    name: cellId,
    formula: [],
    x: x - 1,
    y: y - 1,
    width: 1,
    height: 1,
  };
};

const rootReducer = (state, action) => {
  if (action.type === 'SET_CELL_FORMULA') {
    const { cellId, stringFormula, tableId } = action.payload;

    const existingCell = state.cells.find(({ id }) => id === cellId);

    const cell = existingCell || defaultCellForLocation(tableId, cellId);
    const newFormula = parseFormula(stringFormula, cell.tableId);

    return {
      ...state,
      cells: [
        ...state.cells.filter(({ id }) => id !== cellId),
        {
          ...cell,
          ...newFormula,
        },
      ],
    };
  }

  if (action.type === 'DELETE_CELL') {
    // We're going to reset everything here. In the future we will want to
    // be less destructive. That is to say, if a cell is not referred to
    // in a table, don't modify that table.
    // I think "in the future" we will have a lot of state to keep track
    // of :-/
    const { cellId } = action.payload;
    const existingCell = state.cells.find(({ id }) => id === cellId);

    if (!existingCell) return state;

    const cellsById = getCellsById(state);
    const tablesById = getTablesById(state);

    return {
      ...state,
      cells: state.cells.map((cell) => {
        if (cell === existingCell) return undefined;
        return {
          ...cell,
          formula: cell.formula.map((term) => {
            if (term.ref && term.ref === cellId) {
              return { badRef: unparseTerm(term, cellsById, tablesById) };
            }
            return term;
          }),
        };
      }).filter(Boolean),
    };
  }

  return state;
};

const store = createStore(rootReducer, initialState);
export default store;
