import { createSelector } from 'reselect';

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

export const getCellsByNameForTableId = (state, tableId) => {
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

export const getTablesByName = createSelector(
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
