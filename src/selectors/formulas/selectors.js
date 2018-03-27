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

const getFormulaGraphs = createSelector(
  getCells,
  getTables,
  (cells, tables) => {
    const forwardsGraph = {};
    const backwardsGraph = {};
    [...cells, ...tables].forEach(({ id }) => {
      forwardsGraph[id] = [];
      backwardsGraph[id] = [];
    });
    cells.forEach(({ id, formula }) => {
      const refs = getRefsForExpr(formula);
      refs.forEach((term) => {
        if (term.ref) {
          forwardsGraph[id].push(term.ref);
          backwardsGraph[term.ref].push(id);
        }
      });
    });
    tables.forEach(({ id }) => {
      const tableCells = getCellsByTableId(store.getState(), id);
      tableCells.forEach((cell) => {
        forwardsGraph[id].push(cell.id);
        backwardsGraph[cell.id].push(id);
      });
    });
    return { forwardsGraph, backwardsGraph };
  },
);


export const getTopoSortedRefIds = createSelector(
  getFormulaGraphs,
  ({ backwardsGraph }) => {
    // Count numInArcs
    const numInArcsByCellId = {};
    Object.keys(backwardsGraph).forEach((id) => {
      numInArcsByCellId[id] = 0;
    });
    Object.values(backwardsGraph).forEach((jIds) => {
      jIds.forEach((jId) => { numInArcsByCellId[jId] += 1; });
    });

    // Get all the "leaf" formulas
    const ret = Object.entries(numInArcsByCellId)
      .map(([id, numInArcs]) => numInArcs === 0 && id)
      .filter(Boolean);

    // Append anything only feeds leaf formulas
    for (let i = 0; i < ret.length; ++i) {
      backwardsGraph[ret[i]].forEach((jId) => {
        numInArcsByCellId[jId] -= 1;
        if (numInArcsByCellId[jId] === 0) {
          ret.push(jId);
        }
      });
    }
    return ret;
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


const getRefsForTerm = (term) => {
  if (term.call) {
    return [].concat(
      ...getRefsForTerm(term.call),
      // FIXME: proper args too?
      // eslint-disable-next-line no-use-before-define
      ...[].concat(...term.args.map(({ value }) => getRefsForExpr(value))),
      ...[].concat(...term.args.map(({ ref }) => getRefsForTerm(ref))),
    );
  }
  if (term.op) return [];
  if (term.value !== undefined) return [];
  if (term.name) return [term];
  if (term.ref) return [term];
  throw new Error(`unknown term type ${JSON.stringify(term)}`);
};


const getRefsForExpr = expr =>
  [].concat(...expr.map(getRefsForTerm));


const tableValue = (tableId, globals) => {
  const tableCells = getCellsByTableId(store.getState(), tableId);
  const ret = {
    byId: {},
    byName: {},
    template: tableId,
  };
  tableCells.forEach(({ id, name }) => {
    const { value } = globals[id];
    ret.byId[id] = value;
    ret.byName[name] = value;
  });
  return ret;
};


export const getCellValuesById = createSelector(
  getCells,
  getTables,
  getCellsById,
  getTopoSortedRefIds,
  (allCells, allTables, cellsById, sortedRefIds) => {
    const globals = {};
    [...allCells, ...allTables].forEach(({ id }) => {
      globals[id] = { error: 'Circular ref' };
    });


    sortedRefIds.forEach((id) => {
      const cell = cellsById[id];
      if (!cell) {
        globals[id] = tableValue(id, globals);
        return;
      }
      const { formula } = cell;
      const invalidRefs = formula
        .map(({ ref }) => ref).filter(Boolean)
        .filter(ref => !(ref in globals));

      if (invalidRefs.length > 0) {
        // Depends on a circular reference cell :-(
        globals[id] = { error: 'Circular ref' };
        return;
      }
      const refs = getRefsForExpr(cell.formula);
      const badRefs = refs.filter(({ ref }) => !ref);
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

// eslint-disable-next-line no-unused-vars
const transitiveClosure = (ids, graph) => {
  let frontier = ids;
  const closure = new Set(...frontier);
  while (frontier.length > 0) {
    const newFrontier = [];
    frontier = newFrontier;
    frontier.forEach((id) => {
      const nextNodes = graph[id] || [];
      nextNodes.forEach((nextNode) => {
        if (!closure.has(nextNode)) {
          closure.add(nextNode);
          newFrontier.push(nextNode);
        }
      });
    });
  }
  return closure;
};

// eslint-disable-next-line no-unused-vars
const setIntersection = (setA, setB) => {
  const intersection = new Set();
  setA.forEach((value) => {
    if (setB.has(value)) intersection.add(value);
  });
  return intersection;
};
