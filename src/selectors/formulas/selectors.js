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


export const getTableIdForRef = (ref, defaultTableId) => {
  const tablesById = getTablesById(store.getState());
  const cellsById = getCellsById(store.getState());
  if (tablesById[ref]) return ref;
  const maybeCell = cellsById[ref];
  if (maybeCell) return maybeCell.tableId;
  return defaultTableId;
};


const translateCall = (term, tableId, f) => {
  const call = f(term.call, tableId);
  // Sometimes we're translating names -> refs, sometimes we are
  // translating refs -> printable strings etc :-(.
  const callRef = call.ref || term.call.ref;
  const callTableId = getTableIdForRef(callRef, tableId);
  const translatedArgs = term.args.map(({ ref, expr }) => ({
    ref: f(ref, callTableId),
    expr: translateExpr(expr, tableId, f),
  }));
  return f(
    {
      call,
      args: translatedArgs,
      lookup: term.lookup,
    },
    tableId,
  );
};

export const translateTerm = (term, tableId, f) => {
  if (term.name || term.ref) return f(term, tableId);
  if (term.value !== undefined || term.op) return f(term, tableId);
  if (term.call) return translateCall(term, tableId, f);
  if (term.expression) {
    return f(
      { expression: translateExpr(term.expression, tableId, f) },
      tableId,
    );
  }
  if (term.badFormula) return f(term, tableId);
  throw new Error('Unknown term type');
};


export const translateExpr = (expr, tableId, f) =>
  expr.map(term => translateTerm(term, tableId, f));


const flattenExpr = (expr) => {
  const ret = [];
  translateExpr(expr, null, (term) => {
    if (term === undefined) {
      throw new Error('ahoy!');
    }
    ret.push(term);
    return term;
  });
  return ret;
};

const getFormulaGraphs = createSelector(
  getCells,
  getCellsById,
  getTables,
  getTablesById,
  (cells, cellsById, tables, tablesById) => {
    const forwardsGraph = {};
    const backwardsGraph = {};
    [...cells, ...tables].forEach(({ id }) => {
      forwardsGraph[id] = [];
      backwardsGraph[id] = [];
    });
    cells.forEach(({ id, formula }) => {
      const refs = flattenExpr(formula).filter(({ ref }) =>
        cellsById[ref] || tablesById[ref]);
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

const expandPopItem = k => `globals[${JSON.stringify(k)}].pop();`;

const expandCall = (callTerm) => {
  const signature = callSignature(callTerm);
  const customArgs = callTerm.args.map(({ expr }) =>
    expandExpr(expr));
  const allArgs = [
    'globals',
    'getRef',
    'pleaseThrow',
    'tableValue',
    ...customArgs,
  ].join(', ');
  return `globals[${JSON.stringify(signature)}](${allArgs})`;
};

const expandExpr = (expr) => {
  const expandedTerms = expr.map(term =>
    expandTerm(term));
  return expandedTerms.join(' ');
};

const getRef = (globals, ref) => {
  const values = globals[ref];
  return values[values.length - 1];
};

const expandRef = term => `getRef(globals, ${JSON.stringify(term.ref)}).value`;

const expandLookup = (term) => {
  const termWithoutLookup = { ...term, lookup: undefined };
  const pre = expandTerm(termWithoutLookup);
  const lookupStrings = [];
  for (let l = term.lookup; l; l = l.lookup) {
    lookupStrings.push(`.byName[${JSON.stringify(l.name)}]`);
  }
  return `${pre}${lookupStrings.join('')}`;
};

const expandTerm = (term) => {
  if (term.lookup) return expandLookup(term);
  if (term.ref) return expandRef(term);
  if (term.call) return expandCall(term);
  if (term.op) return term.op;
  if (term.value !== undefined) return JSON.stringify(term.value);
  if (term.expression) return `(${expandExpr(term.expression)})`;
  throw new Error(`unknown term type ${JSON.stringify(term)}`);
};


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

const cellExpressions = (cells, cellsById, tablesById) => {
  const ret = {};
  cells.forEach((cell) => {
    const allTerms = flattenExpr(cell.formula);
    const termErrors = allTerms.filter((term) => {
      if (term.badFormula) return term.badFormula;
      if (term.ref && !(cellsById[term.ref] || tablesById[term.ref])) {
        return term.ref;
      }
      return false;
    }).filter(Boolean);
    if (termErrors.length > 0) {
      ret[cell.id] = `pleaseThrow(${JSON.stringify(termErrors[0])})`;
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
  getTablesById,
  getCellsById,
  getTopoSortedRefIds,
  (allCells, allTables, tablesById, cellsById, sortedRefIds) => {
    const globals = {};

    // Initialize circular refs and things that depend on them.
    [...allCells, ...allTables].forEach(({ id }) => {
      globals[id] = [{ error: 'Circular ref' }];
    });

    // All expressions for cells and tables
    const refExpressions = {
      ...cellExpressions(allCells, cellsById, tablesById),
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

const transitiveClosure = (ids, graph) => {
  let frontier = ids;
  const closure = new Set(frontier);
  while (frontier.length > 0) {
    const newFrontier = [];
    frontier.forEach((id) => {
      const nextNodes = graph[id] || [];
      nextNodes.forEach((nextNode) => {
        if (!closure.has(nextNode)) {
          closure.add(nextNode);
          newFrontier.push(nextNode);
        }
      });
    });
    frontier = newFrontier;
  }
  // Do not include source nodes in transitive closure, we usually want to
  // treat them specially.
  ids.forEach((id) => { closure.delete(id); });
  return closure;
};

const setIntersection = (setA, setB) => {
  const intersection = new Set();
  setA.forEach((value) => {
    if (setB.has(value)) intersection.add(value);
  });
  return intersection;
};

const functionCellsInOrder = (call) => {
  const {
    forwardsGraph,
    backwardsGraph,
  } = getFormulaGraphs(store.getState());
  const argRefs = call.args.map(({ ref }) => ref.ref);
  const dependOnArgs = transitiveClosure(argRefs, backwardsGraph);
  const leadsToValue = transitiveClosure([call.call.ref], forwardsGraph);
  const cellsToEvaluate = setIntersection(dependOnArgs, leadsToValue);

  const topoLocationsById = getTopoLocationById(store.getState());
  return [...cellsToEvaluate].sort((id1, id2) =>
    topoLocationsById[id1] - topoLocationsById[id2]);
};

const createFunction = (callTerm, refExpressions) => {
  const functionBits = [];

  // Code for adding the args to the global state
  callTerm.args.forEach(({ ref }, i) => {
    functionBits.push(expandSetItem(ref.ref, `v${i}`));
  });

  // Code for running the function
  const functionCells = functionCellsInOrder(callTerm);
  functionCells.forEach((id) => {
    functionBits.push(expandSetItem(id, refExpressions[id]));
  });

  // Prepare return value
  functionBits.push(`const ret = ${refExpressions[callTerm.call.ref]};`);

  // Pop all intermediate values from global state
  callTerm.args.forEach(({ ref }) => {
    functionBits.push(expandPopItem(ref.ref));
  });
  functionCells.forEach((id) => {
    functionBits.push(expandPopItem(id));
  });

  // return.
  functionBits.push('return ret;');

  // Construct the function
  const definition = functionBits.join('\n');
  const argNames = callTerm.args.map((arg, i) => `v${i}`);
  // eslint-disable-next-line no-new-func
  return Function(
    'globals',
    'getRef',
    'pleaseThrow',
    'tableValue',
    ...argNames,
    definition,
  );
};
