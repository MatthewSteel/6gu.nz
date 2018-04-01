import store from '../../redux/store';
import { lexFormula } from './lexer';

import {
  getCellsById,
  getCellsByNameForTableId,
  getTablesById,
  getTablesByName,
} from './selectors';

const parseOperators = (tokens, i) => {
  if (!tokens[i].op) {
    throw new Error('Expected a binary operator somewhere');
  }
  let j;
  for ( // any number of unary pluses and minuses after first binary op
    j = i + 1;
    j < tokens.length && tokens[j].op && '+-'.includes(tokens[j].op);
    ++j
  );
  return tokens.slice(i, j);
};

const parseLookups = (tokens, i, lookupObj) => {
  const ret = { ...lookupObj };
  let lastToken = ret;
  let j;
  for (j = i + 1; j < tokens.length && tokens[j].lookup; j += 2) {
    if (j + 1 === tokens.length || !tokens[j + 1].name) {
      throw new Error('Expected name to be looked up');
    }
    lastToken.lookup = { ...tokens[j + 1] };
    lastToken = tokens[j + 1];
  }
  return {
    term: ret,
    newIndex: j,
  };
};


const parseArgsList = (tokens, i) => {
  if (tokens[i].close) {
    return {
      term: [],
      newIndex: i + 1,
    };
  }
  const argsList = [];
  for (let j = i; j < tokens.length; ++j) {
    if (!tokens[j].name) {
      throw new Error('Expected name at start of argument');
    }
    const {
      term: lookups,
      newIndex: eqIndex,
    } = parseLookups(tokens, j, tokens[j]);
    if (eqIndex === tokens.length || !tokens[eqIndex].assignment) {
      throw new Error('Expected assignment in argument');
    }
    if (eqIndex + 1 === tokens.length) {
      throw new Error('Expected expression after equals in argument');
    }
    const {
      term: expression,
      newIndex: expressionIndex,
    } = parseExpression(tokens, eqIndex + 1);
    argsList.push({
      name: lookups,
      expr: expression,
    });
    if (expressionIndex === tokens.length) {
      throw new Error('Expected more after experssion in args list');
    }

    if (tokens[expressionIndex].close) {
      return {
        term: argsList,
        newIndex: expressionIndex + 1,
      };
    }
    if (!tokens[expressionIndex].comma) {
      throw new Error('Expected comma or bracket in args list');
    }
    j = expressionIndex;
  }
  throw new Error('Expected more in args list');
};


const parseTermFromName = (tokens, i) => {
  const { term, newIndex } = parseLookups(tokens, i, tokens[i]);
  const nextToken = tokens[newIndex];
  if (nextToken === undefined || nextToken.op || nextToken.close || nextToken.comma) {
    return {
      term,
      newIndex,
    };
  }
  if (nextToken.open) {
    if (newIndex + 1 === tokens.length) {
      throw new Error("Formula can't end with the start of a call");
    }
    const argsData = parseArgsList(tokens, newIndex + 1);
    const callTerm = {
      call: term,
      args: argsData.term,
    };
    const finalExpr = parseLookups(tokens, argsData.newIndex - 1, callTerm);
    return {
      term: finalExpr.term,
      newIndex: finalExpr.newIndex,
    };
  }
  throw new Error('Unexpected token after name.');
};

const parseTerm = (tokens, i) => {
  if (tokens[i].open) {
    const { term, newIndex } = parseExpression(tokens, i + 1);
    if (!tokens[newIndex] || !tokens[newIndex].close) {
      throw new Error('Expected closing bracket');
    }
    return {
      term: { expression: term },
      newIndex: newIndex + 1,
    };
  }
  if (tokens[i].value !== undefined) {
    return {
      term: tokens[i],
      newIndex: i + 1,
    };
  }
  if (tokens[i].name) {
    return parseTermFromName(tokens, i);
  }
  throw new Error('Unexpected term token');
};

const parseExpression = (tokens, i) => {
  const elements = [];
  for (let j = i; j < tokens.length; ++j) {
    // Precondition: We should be looking at the start of a term.
    const { term, newIndex } = parseTerm(tokens, j);
    elements.push(term);
    j = newIndex;
    if (j === tokens.length || tokens[j].close || tokens[j].comma) {
      return {
        term: elements,
        newIndex: j,
      };
    }
    parseOperators(tokens, j).forEach((op) => {
      elements.push(op);
    });
  }
  throw new Error('Unexpected end of expression');
};


export const parseTokens = (tokens, start) => {
  // There are two legal forms for formulas
  //  1. name? = expression?
  //  2. expression
  if (start === tokens.length) return undefined;
  const { term, newIndex } = parseExpression(tokens, start);
  if (newIndex !== tokens.length) {
    throw new Error('Unchomped tokens at end of forumla');
  }
  return term;
};

const getNameFromTokens = (tokens) => {
  if (tokens[0] && tokens[0].assignment) {
    return { formulaStart: 1, formulaName: {} };
  }
  if (tokens[1] && tokens[1].assignment) {
    if (!tokens[0].name) {
      throw new Error('Can only assign to a name');
    }
    return { formulaStart: 2, formulaName: { name: tokens[0].name } };
  }
  return { formulaStart: 0, formulaName: {} };
};

const subNamesForRefsInName = (term, tableId) => {
  // Three cases:
  // 1. It's the name of a cell in our table. Make a straight ref.
  // 2. It's the name of another table. Make a straight ref.
  // 3. It's a cell looked up on another table. Make a ref to it.
  // Any further lookups are made by name -- no translations.
  const myTableCellsByName = getCellsByNameForTableId(
    store.getState(),
    tableId,
  );
  const maybeMyCell = myTableCellsByName[term.name];

  const tablesByName = getTablesByName(store.getState());
  const maybeThatTable = tablesByName[term.name];

  let eventualRef = term.name; // a bad reference if not replaced
  let eventualLookup = term.lookup;
  if (maybeMyCell) {
    eventualRef = maybeMyCell.id;
  } else if (maybeThatTable) {
    if (!term.lookup) {
      // Just `=table`, not `=table.cell`
      eventualRef = maybeThatTable.id;
    } else {
      // `=table.cell`, we hope
      const thatTableCellsByName = getCellsByNameForTableId(
        store.getState(),
        maybeThatTable.id,
      );
      const thatCell = thatTableCellsByName[term.lookup.name];
      if (thatCell) {
        eventualRef = thatCell.id;
        eventualLookup = thatCell.lookup;
      }
    }
  }
  return {
    lookup: eventualLookup,
    ref: eventualRef,
  };
};

const subNamesForCellRef = (term, tableId) => {
  const cellRef = subNamesForRefsInName(term, tableId);
  if (cellRef.lookup) {
    throw new Error('Got a field ref when we just want a cell ref.');
  }
  return cellRef;
};

const getTableIdForRef = (ref, defaultTableId) => {
  const tablesById = getTablesById(store.getState());
  const cellsById = getCellsById(store.getState());
  if (tablesById[ref]) return ref;
  const maybeCell = cellsById[ref];
  if (maybeCell) return maybeCell.tableId;
  return defaultTableId;
};

const subNamesForRefsInCall = (term, tableId) => {
  // TODO: use the call cell's table for arg refs.
  const call = subNamesForCellRef(term.call, tableId);
  const callTableId = getTableIdForRef(call.ref, tableId);
  const translatedArgs = term.args.map(({ name, expr }) => ({
    ref: subNamesForCellRef(name, callTableId),
    expr: subNamesForRefsInExpr(expr, tableId),
  }));
  return {
    call,
    args: translatedArgs,
    lookup: term.lookup,
  };
};

const subNamesForRefsInTerm = (term, tableId) => {
  if (term.name) {
    return subNamesForRefsInName(term, tableId);
  }
  if (term.call) {
    return subNamesForRefsInCall(term, tableId);
  }
  if (term.expression) {
    return {
      expression: subNamesForRefsInExpr(term.expression, tableId),
    };
  }
  if (term.value !== undefined || term.op) {
    return term;
  }
  throw new Error('Unknown term type');
};

const subNamesForRefsInExpr = (expr, tableId) =>
  expr.map(term => subNamesForRefsInTerm(term, tableId));

const subNamesForRefs = (nameFormula, tableId) => {
  if (!nameFormula) return {};
  return { formula: subNamesForRefsInExpr(nameFormula, tableId) };
};

export const parseFormula = (s, tableId) => {
  try {
    const tokens = lexFormula(s);
    const { formulaStart, formulaName } = getNameFromTokens(tokens);
    return {
      ...formulaName,
      ...parseFormulaExpr(tokens, formulaStart, tableId, s),
    };
  } catch (e) {
    // Really bad -- can't lex or get a name... Formula is totally
    // broken.
    return { formula: [{ badFormula: s }] };
  }
};

const parseFormulaExpr = (tokens, formulaStart, tableId, s) => {
  try {
    return {
      ...subNamesForRefs(parseTokens(tokens, formulaStart), tableId),
    };
  } catch (e) {
    // Bad formula, but we might at least have a name. Stick everything
    // after the `=` symbol (if one exists) into the badFormula attr.
    const formulaStr = (formulaStart === 0) ? s : s.slice(s.indexOf('=') + 1);
    return {
      formula: [{
        badFormula: formulaStr,
      }],
    };
  }
};

const translateRef = (id, tableId) => {
  const tablesById = getTablesById(store.getState());
  const cellsById = getCellsById(store.getState());
  const maybeTable = tablesById[id];
  if (maybeTable) {
    return maybeTable.name;
  }
  const maybeCell = cellsById[id] || store.getState().deletedCells[id];
  if (maybeCell) {
    if (maybeCell.tableId === tableId) return maybeCell.name;
    const cellTable = tablesById[maybeCell.tableId];
    return `${cellTable.name}.${maybeCell.name}`;
  }
  return id; // bad ref from parser, probably
};

export const unparseTerm = (term, tableId) => {
  if (term.lookup) {
    const termWithoutLookup = { ...term, lookup: undefined };
    const pre = unparseTerm(termWithoutLookup, tableId);
    const post = unparseTerm(term.lookup, tableId);
    return `${pre}.${post}`;
  }
  if (term.call) {
    const callee = unparseTerm(term.call, tableId);
    const callTableId = getTableIdForRef(term.call.ref, tableId);
    const argsText = term.args.map(({ ref, expr }) => {
      const refText = unparseTerm(ref, callTableId);
      const exprText = unparseExpr(expr, tableId);
      return `${refText}=${exprText}`;
    }).join(', ');
    return `${callee}(${argsText})`;
  }
  if (term.expression) {
    const expr = unparseExpr(term.expression, tableId);
    return `(${expr})`;
  }
  if (term.badFormula) return term.badFormula;
  if (term.op) return term.op;
  if (term.ref) return translateRef(term.ref, tableId);
  if (term.name) return term.name;
  if (term.value !== undefined) return JSON.stringify(term.value);
  throw new Error('Unknown term type');
};

const unparseExpr = (expr, tableId) => expr.map(term => unparseTerm(term, tableId)).join(' ');

export const stringFormula = (cellId) => {
  const cellsById = getCellsById(store.getState());
  const cell = cellsById[cellId];
  if (!cell) return '';

  const retToJoin = [];
  if (cell.name) {
    retToJoin.push(cell.name);
  }
  retToJoin.push('=');
  cell.formula.forEach((term) => {
    retToJoin.push(unparseTerm(term, cell.tableId));
  });
  return retToJoin.join(' ');
};
