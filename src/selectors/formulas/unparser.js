import store from '../../redux/store';

import {
  getCellsById,
  getSheetsById,
  translateExpr,
} from './selectors';

// Turning a stored raw formula back into a string.

const unparseRef = (id, sheetId) => {
  // id -> sheet_name, local_cell_name, or sheet.distant_cell_name
  const sheetsById = getSheetsById(store.getState());
  const cellsById = getCellsById(store.getState());
  const maybeSheet = sheetsById[id];
  if (maybeSheet) {
    return maybeSheet.name;
  }
  const maybeCell = cellsById[id];
  if (maybeCell) {
    if (maybeCell.sheetId === sheetId) return maybeCell.name;
    const cellSheet = sheetsById[maybeCell.sheetId];
    return `${cellSheet.name}.${maybeCell.name}`;
  }
  return id; // bad ref from parser, probably
};

export const unparseTerm = (term, sheetId) => {
  if (term.lookup) {
    const termWithoutLookup = { ...term, lookup: undefined };
    const pre = unparseTerm(termWithoutLookup, sheetId);
    return `${pre}.${term.lookup}`;
  }
  if (term.lookupIndex) {
    const termWithoutLookup = { ...term, lookupIndex: undefined };
    const pre = unparseTerm(termWithoutLookup, sheetId);
    const post = term.lookupIndex.join(' ');
    return `${pre}[${post}]`;
  }
  if (term.call) {
    const argsText = term.args
      .map(({ ref, expr }) => `${ref}=${expr.join(' ')}`)
      .join(', ');
    return `${term.call}(${argsText})`;
  }
  if (term.expression) return `(${term.expression.join(' ')})`;
  if (term.badFormula) return term.badFormula;
  if (term.op) return term.op;
  if (term.ref) return unparseRef(term.ref, sheetId);
  if (term.name) return term.name;
  if ('value' in term) return JSON.stringify(term.value);
  throw new Error('Unknown term type');
};

export const stringFormula = (cellId) => {
  const cellsById = getCellsById(store.getState());
  const cell = cellsById[cellId];
  if (!cell) return '';

  const retToJoin = [];
  if (cell.name) {
    retToJoin.push(cell.name);
  }
  retToJoin.push('=');
  const terms = translateExpr(cell.formula, cell.sheetId, unparseTerm);
  return [...retToJoin, ...terms].join(' ');
};
