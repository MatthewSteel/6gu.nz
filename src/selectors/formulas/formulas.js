import { createSelector } from 'reselect';
import store from '../../redux/store';

const getCells = state => state.cells;
const getTables = state => state.tables;

const getCellsById = createSelector(
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

const getCellsByName = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => { ret[cell.name] = cell; });
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


export const getCellValuesById = createSelector(
  getCellsById,
  getTopoSortedCellIds,
  (cellsById, sortedCellIds) => {
    const ret = {};

    // eslint-disable-next-line no-unused-vars
    const pleaseThrow = (e) => { throw e; }; // used in eval

    sortedCellIds.forEach((id) => {
      const { formula } = cellsById[id];
      const invalidRefs = formula
        .map(({ ref }) => ref).filter(Boolean)
        .filter(ref => !(ref in ret));
      if (invalidRefs.length > 0) {
        // Depends on a circular reference cell :-(
        return;
      }
      if (formula.length === 0) {
        ret[id] = { value: 0 };
        return;
      }

      const stringParts = formula.map((term, i) => {
        if (term.ref) return `(ret["${term.ref}"].value !== undefined ? ret["${term.ref}"].value : pleaseThrow(ret["${term.ref}"].error))`;
        if (term.badRef) return `pleaseThrow(new Error(formula[${i}].badRef))`;
        if (term.op) return term.op;
        return `formula[${i}].value`;
      });
      try {
        // eslint-disable-next-line no-eval
        ret[id] = { value: eval(stringParts.join(' ')) };
      } catch (e) {
        ret[id] = { error: e.toString() };
      }
    });
    return ret;
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

const parseTokens = (tokens) => {
  const assignments = tokens.filter(token => token.assignment);
  if (assignments.length > 1) {
    throw new Error('Only one assignment allowed in a formula');
  }
  if (assignments.length === 1) {
    if (tokens[0].assignment) return { formula: tokens.slice(1) };
    else if (tokens[1].assignment) {
      if (!tokens[0].name) {
        throw new Error('Assignment operator can only follow a name.');
      }
      if (tokens.length === 2) {
        // No formula after the assignment operator
        // Best to have something...
        tokens.push({ value: 0 });
      }
      return {
        name: tokens[0].name,
        formula: tokens.slice(2),
      };
    }
    throw new Error('Assignment in the middle of a formula');
  }
  return { formula: tokens };
};


const subNamesForRefs = (nameFormula) => {
  const cellsByName = getCellsByName(store.getState());
  return nameFormula.map((term) => {
    if (term.name) {
      const cell = cellsByName[term.name];
      if (!cell) return { badRef: term.name };
      return { ref: cell.id };
    }
    return term;
  });
};

export const parseFormula = (s) => {
  const nameFormula = parseTokens(lexFormula(s));
  if (!nameFormula.formula) return nameFormula; // maybe just a name?
  return {
    ...nameFormula,
    formula: subNamesForRefs(nameFormula.formula),
  };
};

const unparseTerm = (term, cellsById) => {
  if (term.value !== undefined) return JSON.stringify(term.value);
  if (term.op) return term.op;
  if (term.ref) return cellsById[term.ref].name;
  if (term.badRef) return term.badRef;
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
  cell.formula.forEach((term) => {
    retToJoin.push(unparseTerm(term, cellsById));
  });
  return retToJoin.join(' ');
};
