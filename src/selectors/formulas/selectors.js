import { createSelector } from 'reselect';
import store from '../../redux/store';
import { getNamedMember } from './tables';

export const getCells = state => state.cells;
export const getSheets = state => state.sheets;

export const getCellsById = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => { ret[cell.id] = cell; });
    return ret;
  },
);

export const getCellsBySheetIdHelper = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => {
      if (!ret[cell.sheetId]) ret[cell.sheetId] = [];
      ret[cell.sheetId].push(cell);
    });
    return ret;
  },
);

const getCellsByNameForSheetIdHelper = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => {
      if (!ret[cell.sheetId]) ret[cell.sheetId] = {};
      ret[cell.sheetId][cell.name] = cell;
    });
    return ret;
  },
);

export const getCellsByNameForSheetId = (state, sheetId) => {
  const cellsBySheetId = getCellsByNameForSheetIdHelper(state);
  return cellsBySheetId[sheetId] || {};
};

export const getSheetsById = createSelector(
  getSheets,
  (sheets) => {
    const ret = {};
    sheets.forEach((sheet) => { ret[sheet.id] = sheet; });
    return ret;
  },
);

export const getCellsBySheetId = (state, sheetId) => {
  const cellsBySheetId = getCellsBySheetIdHelper(state);
  return cellsBySheetId[sheetId] || [];
};

export const getSheetsByName = createSelector(
  getSheets,
  (sheets) => {
    const ret = {};
    sheets.forEach((sheet) => { ret[sheet.name] = sheet; });
    return ret;
  },
);


export const getSheetIdForRef = (ref, defaultSheetId) => {
  const sheetsById = getSheetsById(store.getState());
  const cellsById = getCellsById(store.getState());
  if (sheetsById[ref]) return ref;
  const maybeCell = cellsById[ref];
  if (maybeCell) return maybeCell.sheetId;
  return defaultSheetId;
};


const translateCall = (term, sheetId, f) => {
  const call = f(term.call, sheetId);
  // Sometimes we're translating names -> refs, sometimes we are
  // translating refs -> printable strings etc :-(.
  const callRef = call.ref || term.call.ref;
  const callSheetId = getSheetIdForRef(callRef, sheetId);
  const translatedArgs = term.args.map(({ ref, expr }) => ({
    ref: f(ref, callSheetId),
    expr: translateExpr(expr, sheetId, f),
  }));
  return f(
    {
      call,
      args: translatedArgs,
      lookup: term.lookup,
    },
    sheetId,
  );
};

export const translateTerm = (term, sheetId, f) => {
  if (term.name || term.ref) return f(term, sheetId);
  if (term.value !== undefined || term.op) return f(term, sheetId);
  if (term.call) return translateCall(term, sheetId, f);
  if (term.expression) {
    return f(
      { expression: translateExpr(term.expression, sheetId, f) },
      sheetId,
    );
  }
  if (term.badFormula) return f(term, sheetId);
  throw new Error('Unknown term type');
};


export const translateExpr = (expr, sheetId, f) =>
  expr.map(term => translateTerm(term, sheetId, f));


export const flattenExpr = (expr) => {
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
  getSheets,
  getSheetsById,
  (cells, cellsById, sheets, sheetsById) => {
    const forwardsGraph = {};
    const backwardsGraph = {};
    [...cells, ...sheets].forEach(({ id }) => {
      forwardsGraph[id] = [];
      backwardsGraph[id] = [];
    });
    cells.forEach(({ id, formula }) => {
      const refs = flattenExpr(formula).filter(term =>
        term.ref && !refError(term, sheetsById, cellsById));
      refs.forEach((term) => {
        forwardsGraph[id].push(term.ref);
        backwardsGraph[term.ref].push(id);
      });
    });
    sheets.forEach(({ id }) => {
      const sheetCells = getCellsBySheetId(store.getState(), id);
      sheetCells.forEach((cell) => {
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


const expandSetItem = (k, expr, override = false) =>
  `try {
    globals[${JSON.stringify(k)}].push({
      value: ${expr}, override: ${override} });
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
    ...customArgs,
  ].join(', ');
  return `globals[${JSON.stringify(signature)}](${allArgs})`;
};

const expandExpr = (expr) => {
  const expandedTerms = expr.map(term =>
    expandTerm(term));
  return expandedTerms.join(' ');
};

const expandRef = term => `globals.getRef(globals, ${JSON.stringify(term.ref)}).value`;

const expandLookup = (term) => {
  // obj.key1.key2 -->
  // lookup(
  //   lookup(
  //     obj
  //   , "key1")
  // , "key2").value
  const termWithoutLookup = { ...term, lookup: undefined };
  const obj = expandTerm(termWithoutLookup);
  const preLookupStrings = [];
  const postLookupStrings = [];
  for (let l = term.lookup; l; l = l.lookup) {
    preLookupStrings.push('globals.getNamedMember(');
    postLookupStrings.push(`, ${JSON.stringify(l.name)})`);
  }
  // just want values in evaluated formulas for now.
  return [...preLookupStrings, obj, ...postLookupStrings].join('');
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


const callSignature = (callTerm) => {
  if (!callTerm.call.ref) {
    throw new Error('Can only call refs');
  }
  const argRefs = callTerm.args.map(({ ref }) => ref.ref);
  const joinedRefs = argRefs.join(',');
  return `${callTerm.call.ref}(${joinedRefs})`;
};


const getRef = (globals, ref) => {
  const values = globals[ref];
  return values[values.length - 1];
};

const sheetValue = (sheetId, globals) => {
  const sheetCells = getCellsBySheetId(store.getState(), sheetId);
  const ret = {
    byId: {},
    byName: {},
    template: sheetId,
  };
  sheetCells.forEach(({ id, name }) => {
    const cellContents = getRef(globals, id);
    ret.byId[id] = cellContents;
    ret.byName[name] = cellContents;
  });
  return ret;
};

// eslint-disable-next-line no-unused-vars
const pleaseThrow = (s) => { throw new Error(s); };

const refError = (term, sheetsById, cellsById) => {
  if (term.badFormula) return term.badFormula;
  if (term.ref && !(cellsById[term.ref] || sheetsById[term.ref])) {
    return term.ref;
  }
  if (term.ref && sheetsById[term.ref] && term.lookup) {
    return `${term.ref}.${term.lookup.name}`;
  }
  return false;
};

const cellExpressions = (cells, cellsById, sheetsById) => {
  const ret = {};
  cells.forEach((cell) => {
    const allTerms = flattenExpr(cell.formula);
    const termErrors = allTerms
      .map(term => refError(term, sheetsById, cellsById))
      .filter(Boolean);
    if (termErrors.length > 0) {
      ret[cell.id] = `globals.pleaseThrow(${JSON.stringify(termErrors[0])} + ' does not exist.')`;
    } else {
      ret[cell.id] = expandExpr(cell.formula);
    }
  });
  return ret;
};

const sheetExpressions = (sheets) => {
  const ret = {};
  sheets.forEach(({ id }) => {
    ret[id] = `globals.sheetValue(${JSON.stringify(id)}, globals)`;
  });
  return ret;
};

export const getCellValuesById = createSelector(
  getCells,
  getSheets,
  getSheetsById,
  getCellsById,
  getTopoSortedRefIds,
  (allCells, allSheets, sheetsById, cellsById, sortedRefIds) => {
    const globals = { getNamedMember, getRef, sheetValue, pleaseThrow };

    // Initialize circular refs and things that depend on them.
    [...allCells, ...allSheets].forEach(({ id }) => {
      globals[id] = [{ error: 'Error: Circular reference (or depends on one)' }];
    });

    // All expressions for cells and sheets
    const refExpressions = {
      ...cellExpressions(allCells, cellsById, sheetsById),
      ...sheetExpressions(allSheets),
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
    return getGlobalValues(globals, allCells, allSheets);
  },
);

const getGlobalValues = (globals, allCells, allSheets) => {
  const ret = {};
  allCells.forEach(({ id }) => { ret[id] = getRef(globals, id); });
  // A bit of a hack: we should try to re-insert sheets that contain
  // circular-ref cells into the topological order, probably.
  allSheets.forEach(({ id }) => { ret[id] = sheetValue(id, globals); });
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
    functionBits.push(expandSetItem(ref.ref, `v${i}`, true));
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
  return Function('globals', ...argNames, definition);
};
