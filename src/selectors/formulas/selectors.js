import { createSelector } from 'reselect';
import store from '../../redux/store';

const getCells = state => state.cells;
export const getTables = state => state.tables;

export const getCellsById = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => { ret[cell.id] = cell; });
    return ret;
  },
);

export const getCellsByTableIdHelper = createSelector(
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
      const refs = flattenExpr(formula).filter(({ ref }) => ref);
      refs.forEach((term) => {
        forwardsGraph[id].push(term.ref);
        backwardsGraph[term.ref].push(id);
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
    const ordering = Object.entries(numInArcsByCellId)
      .map(([id, numInArcs]) => numInArcs === 0 && id)
      .filter(Boolean);

    // Append anything only feeds leaf formulas
    for (let i = 0; i < ordering.length; ++i) {
      backwardsGraph[ordering[i]].forEach((jId) => {
        numInArcsByCellId[jId] -= 1;
        if (numInArcsByCellId[jId] === 0) {
          ordering.push(jId);
        }
      });
    }
    return ordering;
  },
);

const getTopoLocationById = createSelector(
  getTopoSortedRefIds,
  (ordering) => {
    const ret = {};
    ordering.forEach((id, index) => { ret[id] = index; });
    return ret;
  },
);

const callSignature = (callTerm) => {
  if (!callTerm.call.ref) {
    throw new Error('Can only call refs');
  }
  const argRefs = callTerm.args.map(({ ref }) => ref.ref);
  const joinedRefs = argRefs.join(',');
  return `${callTerm.call.ref}(${joinedRefs})`;
};

const expandSetItem = (k, expr) =>
  `try {
    globals[${JSON.stringify(k)}].push({ value: ${expr} });
  } catch (e) {
    globals[${JSON.stringify(k)}].push({ error: e.toString() });
  }`;

// eslint-disable-next-line no-unused-vars
const expandCall = (callTerm, cell) => {
  const signature = callSignature(callTerm);
  const customArgs = callTerm.args.map(({ expr }) =>
    expandExpr(expr, cell));
  const allArgs = ['globals', ...customArgs].join(', ');
  return `globals[${JSON.stringify(signature)}](${allArgs})`;
};

const expandExpr = (expr) => {
  const expandedTerms = expr.map(term =>
    expandTerm(term));
  return expandedTerms.join(' ');
};

// eslint-disable-next-line no-unused-vars
const getRef = (globals, ref) => {
  const values = globals[ref];
  return values[values.length - 1];
};

const expandRef = term => `getRef(globals, ${JSON.stringify(term.ref)}).value`;

const expandTerm = (term) => {
  if (term.ref) {
    // TODO: more lookups
    // FIXME: I guess our lookups might be "backwards"?
    // Should look into that.
    return expandRef(term);
  }
  if (term.call) {
    return expandCall(term);
  }
  if (term.op) return term.op;
  if (term.value !== undefined) return JSON.stringify(term.value);
  if (term.expression) return `(${expandExpr(term.expression)})`;
  throw new Error(`unknown term type ${JSON.stringify(term)}`);
};


const flattenTerm = (term) => {
  if (term.call) {
    return [].concat(
      term,
      ...flattenTerm(term.call),
      ...[].concat(...term.args.map(({ expr }) => flattenExpr(expr))),
      ...[].concat(...term.args.map(({ ref }) => flattenTerm(ref))),
    );
  }
  if (term.op || term.value !== undefined || term.name || term.ref) {
    return [term];
  }
  if (term.expression) {
    return flattenExpr(term.expression);
  }
  throw new Error(`unknown term type ${JSON.stringify(term)}`);
};


const flattenExpr = expr =>
  [].concat(...expr.map(flattenTerm));


// eslint-disable-next-line no-unused-vars
const tableValue = (tableId, globals) => {
  const tableCells = getCellsByTableId(store.getState(), tableId);
  const ret = {
    byId: {},
    byName: {},
    template: tableId,
  };
  tableCells.forEach(({ id, name }) => {
    const cellContents = getRef(globals, id);
    ret.byId[id] = cellContents;
    ret.byName[name] = cellContents.value;
  });
  return ret;
};

// eslint-disable-next-line no-unused-vars
const pleaseThrow = (s) => { throw new Error(s); };

const cellExpressions = (cells) => {
  const ret = {};
  cells.forEach((cell) => {
    const allTerms = flattenExpr(cell.formula);
    const badRefs = allTerms.filter(({ name, ref }) => name && !ref);
    if (badRefs.length > 0) {
      ret[cell.id] = `pleaseThrow(${JSON.stringify(badRefs[0].name)})`;
    } else {
      ret[cell.id] = expandExpr(cell.formula);
    }
  });
  return ret;
};

const tableExpressions = (tables) => {
  const ret = {};
  tables.forEach(({ id }) => {
    ret[id] = `tableValue(${JSON.stringify(id)}, globals)`;
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

    // Initialize circular refs and things that depend on them.
    [...allCells, ...allTables].forEach(({ id }) => {
      globals[id] = [{ error: 'Circular ref' }];
    });

    // All expressions for cells and tables
    const refExpressions = {
      ...cellExpressions(allCells),
      ...tableExpressions(allTables),
    };

    // Write all functions
    const allFormulas = allCells.map(({ formula }) => formula);
    const allTerms = [].concat(...allFormulas.map(flattenExpr));
    const allCalls = allTerms.filter(({ call }) => !!call);
    allCalls.forEach((callTerm) => {
      globals[callSignature(callTerm)] = createFunction(callTerm, refExpressions);
    });

    // Evaluate every cell.
    sortedRefIds.forEach((id) => {
      // eslint-disable-next-line no-eval
      eval(expandSetItem(id, refExpressions[id]));
    });
    return getGlobalValues(globals, allCells, allTables);
  },
);

const getGlobalValues = (globals, allCells, allTables) => {
  const ret = {};
  allCells.forEach(({ id }) => { ret[id] = getRef(globals, id); });
  // A bit of a hack: we should try to re-insert tables that contain
  // circular-ref cells into the topological order, probably.
  allTables.forEach(({ id }) => { ret[id] = tableValue(id, globals); });
  return ret;
};

// eslint-disable-next-line no-unused-vars
const expandPopItems = () => '';

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

const setIntersection = (setA, setB) => {
  const intersection = new Set();
  setA.forEach((value) => {
    if (setB.has(value)) intersection.add(value);
  });
  return intersection;
};

// eslint-disable-next-line no-unused-vars
const functionCellsInOrder = (call) => {
  const {
    forwardsGraph,
    backwardsGraph,
  } = getFormulaGraphs(store.getState);
  const argRefs = call.args.map(({ ref }) => ref.ref);
  const dependOnArgs = transitiveClosure(argRefs, backwardsGraph);
  const leadsToValue = transitiveClosure(call.call, forwardsGraph);
  const cellsToEvaluate = setIntersection(dependOnArgs, leadsToValue);

  const topoLocationsById = getTopoLocationById(store.getState());
  return [...cellsToEvaluate].sort((id1, id2) =>
    topoLocationsById[id1] - topoLocationsById[id2]);
};

const createFunction = (callTerm /* , refExpressions */) => {
  // const functionCells = functionCellsInOrder(callTerm);

  const definition = 'return 0;'; // TODO
  const argNames = callTerm.args.map((arg, i) => `v${i}`);
  // eslint-disable-next-line no-new-func
  return Function(...argNames, definition);
};
