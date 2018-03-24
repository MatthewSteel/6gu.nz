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
// eslint-disable-next-line no-unused-vars
const call = (value = {}, args, globals) => value.f(args, globals, value.f);

// NOTE: We are ok with "cannot read property '`key`' of undefined" but would
// rather not leak "cannot read property 'data' of undefined"
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
    const expandedCallee = expandTerm(term.call);
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
      // eslint-disable-next-line no-use-before-define
      ...[].concat(...term.args.map(getBadRefsForExpr)),
    );
  }
  if (term.op) return [];
  if (term.value !== undefined) return [];
  if (term.badRef) return [term];
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
        globals[id] = { error: badRefs[0].badRef };
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
const isNameChar = c => c.match(/^[0-9a-zA-Z_.]$/u);

const lexName = (input, i) => {
  // TODO: We shouldn't do `.` parsing in the lexer, we should do it in the
  // parser...
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
  if (next.match(/^[()[\]{}+\-*/%,]$/)) {
    return { matchEnd: i + 1, token: { op: next } };
  }
  if (canStartName(next)) return lexName(input, i);
  if (next.match(/^[.0-9]$/)) return lexNumber(input, i);
  if (next === '"') return lexString(input, i);
  if (next.match(/^\s$/)) return chompWhitespace(input, i);
  if (next === '=') return { matchEnd: i + 1, token: { assignment: next } };
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

const parseExpression = (tokens) => {
  if (tokens.length === 0) return [{ value: 0 }];
  // TODO: proper parsing and error-handling.
  return tokens;
};

const parseTokens = (tokens) => {
  // There are two legal forms for formulas
  //  1. name? = expression?
  //  2. expression
  if (tokens[0] && tokens[0].assignment) {
    return { formula: parseExpression(tokens.slice(1)) };
  }
  if (tokens[1] && tokens[1].assignment && tokens[0].name) {
    return {
      name: tokens[0].name,
      formula: parseExpression(tokens.slice(2)),
    };
  }
  return { formula: parseExpression(tokens) };
};

const subNamesForRefs = (nameFormula, tableId) => {
  const tablesByName = getTablesByName(store.getState());
  return nameFormula.map((term) => {
    if (term.name) {
      const parts = term.name.split('.');
      if (parts.length > 2) return { badRef: term.name };
      const refCellName = parts.pop();
      const refTableName = parts.pop();
      const refTableId = refTableName ? tablesByName[refTableName].id : tableId;
      if (!refTableId) return { badRef: term.name };

      const tableCellsByName = getCellsByNameForTableId(
        store.getState(),
        refTableId,
      );
      const cell = tableCellsByName[refCellName];
      if (!cell) return { badRef: term.name };

      if (refTableName) {
        return { ref: cell.id, tableRef: refTableId };
      }
      return { ref: cell.id };
    }
    return term;
  });
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
  if (term.value !== undefined) return JSON.stringify(term.value);
  if (term.op) return term.op;
  if (term.ref) {
    if (term.tableRef) {
      return `${tablesById[term.tableRef].name}.${cellsById[term.ref].name}`;
    }
    return cellsById[term.ref].name;
  }
  if (term.badRef) return term.badRef;
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
