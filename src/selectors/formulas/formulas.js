import { createSelector } from 'reselect';
import store from '../../redux/store';

const getCells = state => state.cells;
const getTables = state => state.tables;

export const getCellsById = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => { ret[cell.id] = cell; });
    return ret;
  },
);

const getCellsByTableIdHelper = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => {
      if (!ret[cell.tableId]) ret[cell.tableId] = [];
      ret[cell.tableId].push(cell);
    });
    return ret;
  },
);

const getCellsByNameForTableIdHelper = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => {
      if (!ret[cell.tableId]) ret[cell.tableId] = {};
      ret[cell.tableId][cell.name] = cell;
    });
    return ret;
  },
);

const getCellsByNameForTableId = (state, tableId) => {
  const cellsByTableId = getCellsByNameForTableIdHelper(state);
  return cellsByTableId[tableId] || {};
};

export const getTablesById = createSelector(
  getTables,
  (tables) => {
    const ret = {};
    tables.forEach((table) => { ret[table.id] = table; });
    return ret;
  },
);

export const getCellsByTableId = (state, tableId) => {
  const cellsByTableId = getCellsByTableIdHelper(state);
  return cellsByTableId[tableId] || [];
};

const getTablesByName = createSelector(
  getTables,
  (tables) => {
    const ret = {};
    tables.forEach((table) => { ret[table.name] = table; });
    return ret;
  },
);

const getCellFormulaGraph = createSelector(
  getCells,
  (cells) => {
    const graph = {};
    cells.forEach(({ id, formula }) => {
      graph[id] = [];
      formula.forEach((term) => {
        if (term.ref) graph[id].push(term.ref);
      });
    });
    return graph;
  },
);


export const getTopoSortedCellIds = createSelector(
  getCellFormulaGraph,
  (graph) => {
    // Count numInArcs
    const numInArcsByCellId = {};
    Object.keys(graph).forEach((id) => { numInArcsByCellId[id] = 0; });
    Object.values(graph).forEach((jIds) => {
      jIds.forEach((jId) => { numInArcsByCellId[jId] += 1; });
    });

    // Get all the "leaf" formulas
    const ret = Object.entries(numInArcsByCellId)
      .map(([id, numInArcs]) => numInArcs === 0 && id)
      .filter(Boolean);

    // Append anything only feeds leaf formulas
    for (let i = 0; i < ret.length; ++i) {
      graph[ret[i]].forEach((jId) => {
        numInArcsByCellId[jId] -= 1;
        if (numInArcsByCellId[jId] === 0) {
          ret.push(jId);
        }
      });
    }
    return ret.reverse();
  },
);


// eslint-disable-next-line no-unused-vars
const getCell = (id, things) => things[id].value;


const expandExpr = (formula, cell, cellsById, inFunction) => {
  const expandedTerms = formula.map(term =>
    // eslint-disable-next-line no-use-before-define
    expandTerm(term, cell, cellsById, inFunction));
  return expandedTerms.join(' ');
};

// NOTE: We are ok with "undefined is not a function", but would rather not
// leak "cannot read property 'f' of undefined"
// TODO: Will probably become a problem if it is not an object...
// Probably just call it `evaluate` or `call` and leak it?
// eslint-disable-next-line no-unused-vars
const call = (value = {}, args, globals) => value.f(args, globals, value.f);

// NOTE: We are ok with "cannot read property '`key`' of undefined" but would
// rather not leak "cannot read property 'data' of undefined"
// TODO: Will probably become a problem if it is not an object...
// Probably just call it `contents` and leak it?
// eslint-disable-next-line no-unused-vars
const lookup = (value = {}, key) => value.data[key];


const expandTerm = (term, cell, cellsById, inFunction) => {
  if (term.ref) {
    const refTable = cellsById[term.ref].tableId;
    const isLocalRef = inFunction && cell.tableId === refTable;
    const tableName = isLocalRef ? 'data' : 'globals';
    const lookupValue = isLocalRef ? cellsById[term.ref].name : term.ref;
    return `getCell(${JSON.stringify(lookupValue)}, ${tableName})`;
  }
  if (term.call) {
    const expandedCallee = expandTerm(term.call, cell, cellsById, inFunction);
    // TODO: actually assignments. JSON.stringify(name): expr.
    const expandedArgs = term.args.map(argExpr =>
      expandExpr(argExpr, cell, cellsById, inFunction));
    const joinedArgs = `{${expandedArgs.join(', ')}}`;
    return `call(${expandedCallee}, ${joinedArgs}, globals)`;
  }
  if (term.op) return term.op;
  if (term.value !== undefined) return JSON.stringify(term.value);
  throw new Error(`unknown term type ${JSON.stringify(term)}`);
};


const getBadRefsForTerm = (term) => {
  if (term.ref) return [];
  if (term.call) {
    return [].concat(
      ...getBadRefsForTerm(term.call),
      // FIXME: proper args too?
      // eslint-disable-next-line no-use-before-define
      ...[].concat(...term.args.map(({ value }) => getBadRefsForExpr(value))),
      ...[].concat(...term.args.map(({ ref }) => getBadRefsForTerm(ref))),
    );
  }
  if (term.op) return [];
  if (term.value !== undefined) return [];
  if (term.name) return [term];
  throw new Error(`unknown term type ${JSON.stringify(term)}`);
};


const getBadRefsForExpr = expr =>
  [].concat(...expr.map(getBadRefsForTerm));


export const getCellValuesById = createSelector(
  getCellsById,
  getTopoSortedCellIds,
  (cellsById, sortedCellIds) => {
    const globals = {};

    sortedCellIds.forEach((id) => {
      const cell = cellsById[id];
      const { formula } = cell;
      const invalidRefs = formula
        .map(({ ref }) => ref).filter(Boolean)
        .filter(ref => !(ref in globals));

      if (invalidRefs.length > 0) {
        // Depends on a circular reference cell :-(
        return;
      }
      const badRefs = getBadRefsForExpr(cell.formula);
      if (badRefs.length > 0) {
        globals[id] = { error: badRefs[0].name };
        return;
      }

      const expandedExpr = expandExpr(formula, cell, cellsById, false);
      try {
        // eslint-disable-next-line no-eval
        globals[id] = { value: eval(expandedExpr) };
      } catch (e) {
        globals[id] = { error: e.toString() };
      }
    });
    return globals;
  },
);


const canStartName = c => c.match(/^[a-zA-Z_]$/u);
const isNameChar = c => c.match(/^[0-9a-zA-Z_]$/u);

const lexName = (input, i) => {
  let j;
  for (j = i; j < input.length && isNameChar(input.charAt(j)); ++j);
  return { matchEnd: j, token: { name: input.substring(i, j) } };
};

const lexNumber = (input, i) => {
  const numberChars = /^[0-9.]$/; // no 1e-10 etc for now
  let j;
  for (j = i; j < input.length && input.charAt(j).match(numberChars); ++j);
  return {
    matchEnd: j,
    token: { value: JSON.parse(input.substring(i, j)) },
  };
};

const lexString = (input, i) => {
  const delim = input.charAt(i);
  let j;
  for (j = i + 1; j < input.length; ++j) {
    const next = input.charAt(j);
    if (next === delim) {
      return {
        matchEnd: j + 1,
        token: { value: JSON.parse(input.substring(i, j + 1)) },
      };
    }
    if (next === '\\') ++j;
  }
  throw new Error('Unterminated string');
};

const chompWhitespace = (input, i) => {
  let j;
  for (j = i; j < input.length && input.charAt(j).match(/^\s$/); ++j);
  return { matchEnd: j };
};

const lexOne = (input, i) => {
  const next = input.charAt(i);
  if (next.match(/^[+\-*/%]$/)) {
    return { matchEnd: i + 1, token: { op: next } };
  }
  if (next === '(') return { matchEnd: i + 1, token: { open: '(' } };
  if (next === ')') return { matchEnd: i + 1, token: { close: ')' } };
  if (canStartName(next)) return lexName(input, i);
  if (next.match(/^[0-9]$/)) return lexNumber(input, i);
  if (next === '"') return lexString(input, i);
  if (next.match(/^\s$/)) return chompWhitespace(input, i);
  if (next === '=') return { matchEnd: i + 1, token: { assignment: next } };
  if (next === '.') return { matchEnd: i + 1, token: { lookup: next } };
  if (next === ',') return { matchEnd: i + 1, token: { comma: next } };
  throw new Error(`don't know what to do with '${next}'`);
};

const lexFormula = (input) => {
  let i = 0;
  const ret = [];
  while (i < input.length) {
    const { matchEnd, token } = lexOne(input, i);
    if (token) ret.push(token);
    i = matchEnd;
  }
  return ret;
};

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


const parseLookups = (tokens, i) => {
  const ret = { ...tokens[i] };
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
    } = parseLookups(tokens, i);
    if (eqIndex === tokens.length || !tokens[eqIndex].assignment) {
      throw new Error('Expected assignment in argument');
    }
    if (eqIndex + 1 === tokens.length) {
      throw new Error('Expected expression after equals in argument');
    }
    const {
      term: expression,
      newIndex: expressionIndex,
    } = parseExpression(tokens, i);
    argsList.push({
      ref: lookups,
      value: expression,
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
    j = expressionIndex + 1;
  }
  throw new Error('Expected more in args list');
};


const parseTermFromName = (tokens, i) => {
  const { term, newIndex } = parseLookups(tokens, i);
  if (newIndex === tokens.length || tokens[newIndex].op) {
    return {
      term,
      newIndex,
    };
  }
  if (tokens[i].open) {
    if (newIndex + 1 === tokens.length) {
      throw new Error("Formula can't end with the start of a call");
    }
    const argsData = parseArgsList(tokens, newIndex + 1);
    return {
      term: {
        call: term,
        args: argsData.term,
      },
      newIndex: argsData.newIndex,
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
      newIndex: newIndex + 2,
    };
  }
  if (tokens[i].value) {
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
    if (j === tokens.length || tokens[j].op === ')') {
      return {
        term: { expression: elements },
        newIndex: j,
      };
    }
    parseOperators(tokens, j).forEach((op) => {
      elements.push(op);
    });
  }
  throw new Error('Unexpected end of expression');
};


const parseTokens = (tokens) => {
  // There are two legal forms for formulas
  //  1. name? = expression?
  //  2. expression
  const doParse = (start) => {
    if (start === tokens.length) return { expression: [{ value: 0 }] };
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
    call: subNamesForCellRef(term, tableId, tablesByName),
    args: translatedArgs,
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
    return subNamesForRefsInExpr(term, tableId, tablesByName);
  }
  if (term.value || term.op) {
    return term;
  }
  throw new Error('Unknown term type');
};

const subNamesForRefsInExpr = (expr, tableId, tablesByName) =>
  expr.map(term => subNamesForRefsInTerm(term, tableId, tablesByName));

const subNamesForRefs = (nameFormula, tableId) => {
  const tablesByName = getTablesByName(store.getState());
  return subNamesForRefsInExpr(nameFormula.expression, tableId, tablesByName);
};

export const parseFormula = (s, tableId) => {
  const nameFormula = parseTokens(lexFormula(s));
  if (!nameFormula.formula) return nameFormula; // maybe just a name?
  return {
    ...nameFormula,
    formula: subNamesForRefs(nameFormula.formula, tableId),
  };
};

export const unparseTerm = (term, cellsById, tablesById) => {
  if (term.call) {
    const callee = unparseTerm(term.call, cellsById, tablesById);
    const argsText = term.args.map(({ ref, value }) => {
      const refText = unparseTerm(ref, cellsById, tablesById);
      const valueText = unparseTerm(value, cellsById, tablesById);
      return `${refText}=${valueText}`;
    }).join(', ');
    return `${callee}(${argsText})`;
  }
  if (term.expression) {
    return term.expression.map(child =>
      unparseTerm(child, cellsById, tablesById)).join(' ');
  }
  if (term.op) return term.op;
  if (term.name) { // ref or bad-ref
    let fullName = '';
    for (let termIt = term; termIt; termIt = termIt.lookup) {
      fullName += termIt.name;
    }
    return fullName;
  }
  if (term.value !== undefined) return JSON.stringify(term.value);
  throw new Error('Unknown term type');
};

export const stringFormula = (cellId) => {
  const cellsById = getCellsById(store.getState());
  const tablesById = getTablesById(store.getState());
  const cell = cellsById[cellId];
  if (!cell) return '';

  const retToJoin = [];
  if (cell.name) {
    retToJoin.push(cell.name);
  }
  retToJoin.push('=');
  cell.formula.forEach((term) => {
    retToJoin.push(unparseTerm(term, cellsById, tablesById));
  });
  return retToJoin.join(' ');
};
