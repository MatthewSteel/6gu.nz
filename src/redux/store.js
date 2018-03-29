import { createStore } from 'redux';
import uuidv4 from 'uuid-v4';
import { getCellsById } from '../selectors/formulas/selectors';
import { parseFormula } from '../selectors/formulas/parser';
import defaultCellName from '../selectors/formulas/defaultCellName';


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
    formula: [{ ref: 'cell0', name: 'Fred' }],
    x: 0,
    y: 1,
    width: 1,
    height: 1,
  }, {
    id: 'cell3',
    tableId: 'table0',
    name: 'Tui',
    formula: [{ ref: 'cell2', name: 'Wiremu' }, { op: '+' }, { value: 'quux' }],
    x: 1,
    y: 1,
    width: 3,
    height: 4,
  }],
};

export const setFormula = (tableId, cellId, formula) => ({
  type: 'SET_CELL_FORMULA',
  payload: { tableId, cellId, formulaStr: formula },
});

export const deleteCell = cellId => ({
  type: 'DELETE_CELL',
  payload: { cellId },
});

const defaultCellForLocation = (tableId, cellId) => {
  const [y, x] = cellId.split(',').map(Number);
  return {
    tableId,
    id: uuidv4(),
    name: defaultCellName(y, x),
    formula: [{ value: 0 }],
    x,
    y,
    width: 1,
    height: 1,
  };
};

const rootReducer = (state, action) => {
  if (action.type === 'SET_CELL_FORMULA') {
    const { cellId, formulaStr, tableId } = action.payload;

    const existingCell = state.cells.find(({ id }) => id === cellId);

    const cell = existingCell || defaultCellForLocation(tableId, cellId);

    // Includes maybe name and maybe formula.
    const newFormula = parseFormula(formulaStr, cell.tableId);

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
    const existingCell = getCellsById(state)[cellId];
    if (!existingCell) return state;

    return {
      ...state,
      cells: state.cells.filter(({ id }) => id !== cellId),
    };
  }

  return state;
};

const store = createStore(rootReducer, initialState);
export default store;
