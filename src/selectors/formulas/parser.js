import store from '../../redux/store';
import { lexFormula } from './lexer';

import {
  getCellsById,
  getCellsByNameForTableId,
  getTablesByName,
} from './selectors';

const parseOperators = (tokens, i) => {
  if (!tokens[i].op || !tokens[i].op.match(/^[+\-*/%,]$/)) {
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


export const parseTokens = (tokens) => {
  // There are two legal forms for formulas
  //  1. name? = expression?
  //  2. expression
  const doParse = (start) => {
    if (start === tokens.length) return [{ value: 0 }];
    const { term, newIndex } = parseExpression(tokens, start);
    if (newIndex !== tokens.length) {
      throw new Error('Unchomped tokens at end of forumla');
    }
    return term;
  };

  if (tokens[0] && tokens[0].assignment) {
    return { formula: doParse(1) };
  }
  if (tokens[1] && tokens[1].assignment) {
    return {
      name: tokens[0].name,
      formula: doParse(2),
    };
  }
  return { formula: doParse(0) };
};

const subNamesForRefsInName = (term, tableId, tablesByName) => {
  // A few cases:
  // 1. It's the name of a cell in our table. Make a straight ref.
  // 2. It's the name of a cell in anot
  const myTableCellsByName = getCellsByNameForTableId(
    store.getState(),
    tableId,
  );

  const maybeMyCell = myTableCellsByName[term.name];
  if (maybeMyCell) {
    return {
      ...term,
      ref: maybeMyCell.id,
    };
  }

  const thatTable = tablesByName[term.name];
  if (thatTable) {
    if (!term.lookup) {
      return {
        ...term,
        ref: thatTable.id,
      };
    }
    const thatTableCellsByName = getCellsByNameForTableId(
      store.getState(),
      thatTable.id,
    );
    const thatCell = thatTableCellsByName[term.lookup.name];
    if (thatCell) {
      return {
        ...term.lookup.name,
        name: `${thatTable.name}.${thatCell.name}`,
        ref: thatCell.id,
      };
    }
  }

  // Not a direct cell reference, not a straight table reference,
  // not a table.cell reference. No idea.
  // Returned value has a name but no ref.
  return term;
};

const subNamesForCellRef = (term, tableId, tablesByName) => {
  const cellRef = subNamesForRefsInName(term, tableId, tablesByName);
  if (cellRef.lookup) {
    throw new Error('Got a field ref when we just want a cell ref.');
  }
  return cellRef;
};

const subNamesForRefsInCall = (term, tableId, tablesByName) => {
  const translatedArgs = term.args.map(({ name, expr }) => ({
    ref: subNamesForCellRef(name, tableId, tablesByName),
    expr: subNamesForRefsInExpr(expr, tableId, tablesByName),
  }));
  return {
    call: subNamesForCellRef(term.call, tableId, tablesByName),
    args: translatedArgs,
    lookup: term.lookup,
  };
};

const subNamesForRefsInTerm = (term, tableId, tablesByName) => {
  if (term.name) {
    return subNamesForRefsInName(term, tableId, tablesByName);
  }
  if (term.call) {
    return subNamesForRefsInCall(term, tableId, tablesByName);
  }
  if (term.expression) {
    return {
      expression: subNamesForRefsInExpr(term.expression, tableId, tablesByName),
    };
  }
  if (term.value !== undefined || term.op) {
    return term;
  }
  throw new Error('Unknown term type');
};

const subNamesForRefsInExpr = (expr, tableId, tablesByName) =>
  expr.map(term => subNamesForRefsInTerm(term, tableId, tablesByName));

const subNamesForRefs = (nameFormula, tableId) => {
  const tablesByName = getTablesByName(store.getState());
  return subNamesForRefsInExpr(nameFormula, tableId, tablesByName);
};

export const parseFormula = (s, tableId) => {
  const nameFormula = parseTokens(lexFormula(s));
  if (!nameFormula.formula) return nameFormula; // maybe just a name?
  return {
    ...nameFormula,
    formula: subNamesForRefs(nameFormula.formula, tableId),
  };
};

export const unparseTerm = (term) => {
  if (term.lookup) {
    const termWithoutLookup = { ...term, lookup: undefined };
    const pre = unparseTerm(termWithoutLookup);
    const post = unparseTerm(term.lookup);
    return `${pre}.${post}`;
  }
  if (term.call) {
    const callee = unparseTerm(term.call);
    const argsText = term.args.map(({ ref, expr }) => {
      const refText = unparseTerm(ref);
      const exprText = unparseExpr(expr);
      return `${refText}=${exprText}`;
    }).join(', ');
    return `${callee}(${argsText})`;
  }
  if (term.expression) {
    const expr = unparseExpr(term.expression);
    return `(${expr})`;
  }
  if (term.op) return term.op;
  if (term.name) return term.name; // ref or bad-ref
  if (term.value !== undefined) return JSON.stringify(term.value);
  throw new Error('Unknown term type');
};

const unparseExpr = expr => expr.map(unparseTerm).join(' ');

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
    retToJoin.push(unparseTerm(term));
  });
  return retToJoin.join(' ');
};
