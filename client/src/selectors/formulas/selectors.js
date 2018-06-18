import { createSelector } from 'reselect';
import {
  topologicalOrdering,
  transitiveClosure,
  nodesInLargeStronglyConnectedComponents,
} from '../algorithms/algorithms';
import { globalFunctions, globalFunctionArgs } from './builtins';
import {
  ARRAY,
  ARRAY_CELL,
  CELL,
  OBJECT,
  OBJECT_CELL,
  SHEET,
  TABLE,
  TABLE_CELL,
  COMPUTED_TABLE_COLUMN,
  TABLE_COLUMN,
  TABLE_ROW,
} from '../../redux/stateConstants';

// Simple "get raw state" selectors (for the moment?)

export const getCells = state => state.openDocument.data.cells;
export const getSheets = state => state.openDocument.data.sheets;
export const getLoginState = state => state.userState.loginState;

export const getRefs = createSelector(
  getCells,
  getSheets,
  (cells, sheets) => cells.concat(sheets),
);

export const getRefsById = createSelector(
  getRefs,
  (refs) => {
    const ret = {};
    refs.forEach((ref) => { ret[ref.id] = ref; });
    return ret;
  },
);

export const getChildIdsByParentId = createSelector(
  getRefs,
  (refs) => {
    const ret = {};
    refs.forEach((ref) => { ret[ref.id] = []; });
    refs.forEach((ref) => {
      if (ref.sheetId) ret[ref.sheetId].push(ref.id);
      if (ref.arrayId) ret[ref.arrayId].push(ref.id);
      if (ref.tableId) ret[ref.tableId].push(ref.id);
      if (ref.objectId) ret[ref.objectId].push(ref.id);
    });
    return ret;
  },
);

export const getChildrenOfRef = (state, parentId) => {
  const childIds = getChildIdsByParentId(state)[parentId];
  const refsById = getRefsById(state);
  return childIds.map(id => refsById[id]);
};

export const transitiveChildren = (state, refId) => {
  // Sheet -> table -> cell etc. Not formula references.
  const childrenByParentId = getChildIdsByParentId(state);
  const descendants = transitiveClosure([refId], childrenByParentId);
  descendants.add(refId);
  return descendants;
};

export const getCellsById = createSelector(
  getCells,
  (cells) => {
    const ret = {};
    cells.forEach((cell) => { ret[cell.id] = cell; });
    return ret;
  },
);

const getRefsByNameForContextIdHelper = createSelector(
  getRefs,
  getRefsById,
  (refs, refsById) => {
    const ret = {};
    refs.forEach((ref) => { ret[ref.id] = {}; });
    refs.forEach((ref) => {
      if (ref.sheetId) {
        ret[ref.sheetId][ref.name] = ref;
      }
      if (ref.objectId && ref.name) {
        ret[ref.objectId][ref.name] = ref;
      }
      if (ref.tableId) {
        if (ref.type === TABLE_ROW) ret[ref.tableId][ref.index] = ref;
        if (ref.type === TABLE_COLUMN || ref.type === COMPUTED_TABLE_COLUMN) {
          ret[ref.tableId][ref.name] = ref;
        }
      }
      if (ref.arrayId && 'index' in ref) { // table cells have no index
        ret[ref.arrayId][ref.index] = ref;
      }
      if (ref.type === TABLE_CELL) {
        const columnParent = refsById[ref.arrayId];
        ret[ref.objectId][columnParent.name] = ref;
        const rowParent = refsById[ref.objectId];
        ret[ref.arrayId][rowParent.index] = ref;
      }
    });
    return ret;
  },
);

export const getRefsByNameForContextId = (state, contextId) => {
  const refsByContextId = getRefsByNameForContextIdHelper(state);
  return refsByContextId[contextId] || {};
};

export const getSheetsById = createSelector(
  getSheets,
  (sheets) => {
    const ret = {};
    sheets.forEach((sheet) => { ret[sheet.id] = sheet; });
    return ret;
  },
);

export const getSheetsByName = createSelector(
  getSheets,
  (sheets) => {
    const ret = {};
    sheets.forEach((sheet) => { ret[sheet.name] = sheet; });
    return ret;
  },
);

export const sheetPlacedCellLocs = createSelector(
  getSheets,
  getCells,
  (sheets, cells) => {
    const ret = {};
    sheets.forEach(({ id }) => { ret[id] = {}; });
    cells.forEach(({ sheetId, id, x, y, width, height }) => {
      if (!sheetId) return;

      const sheetPlacedLocs = ret[sheetId];
      for (let cx = x; cx < x + width; ++cx) {
        for (let cy = y; cy < y + height; ++cy) {
          sheetPlacedLocs[`${cy},${cx}`] = id;
        }
      }
    });
    return ret;
  },
);

export const refsAtPosition = createSelector(
  getCells,
  getRefsById,
  (cells, refsById) => {
    const ret = {};
    cells.forEach((cell) => {
      if ([OBJECT, ARRAY, TABLE_ROW].includes(cell.type)) {
        ret[cell.id] = [];
      } else if (cell.type === TABLE) {
        ret[cell.id] = { rows: [], columns: [], cells: {} };
      }
    });
    cells.forEach((cell) => {
      if (cell.type === OBJECT_CELL) {
        ret[cell.objectId][cell.index] = cell;
      } else if (cell.type === ARRAY_CELL) {
        ret[cell.arrayId][cell.index] = cell;
      } else if (cell.type === TABLE_ROW) {
        ret[cell.tableId].rows[cell.index] = cell;
      } else if (cell.type === TABLE_COLUMN || cell.type === COMPUTED_TABLE_COLUMN) {
        ret[cell.tableId].columns[cell.index] = cell;
      } else if (cell.type === TABLE_CELL) {
        const col = refsById[cell.arrayId];
        const rowIndex = refsById[cell.objectId].index;
        ret[col.tableId].cells[`${rowIndex},${col.index}`] = cell;
      }
    });
    return ret;
  },
);

export const refParentId = (ref) => {
  if (ref === undefined) return undefined;
  if (ref.sheetId) return ref.sheetId;
  if (ref.objectId) return ref.objectId;
  if (ref.arrayId) return ref.arrayId; // NOTE: table cells use objectId
  if (ref.tableId) return ref.tableId;
  if (ref.type !== SHEET) throw new Error(`unknown ref type ${ref.type}`);
  return undefined;
};

const refHeight = (ref) => {
  if (ref === undefined) return 0;
  if (ref.type === SHEET) return 1;
  if (ref.type === ARRAY) return 2;
  if (ref.type === ARRAY_CELL) return 3;
  if (ref.type === OBJECT) return 2;
  if (ref.type === OBJECT_CELL) return 3;
  if (ref.type === TABLE) return 2;
  if (ref.type === TABLE_ROW) return 3;
  if (ref.type === TABLE_COLUMN) return 3;
  if (ref.type === TABLE_CELL) return 4;
  if (ref.type !== CELL) throw new Error(`unknown ref type ${ref.type}`);
  return 2;
};

export const rewriteRefTermToParentLookup = (refsById, innermostLookup) => {
  if (!innermostLookup.ref) throw new Error('Must pass lookup on `refId`');
  const ref = refsById[innermostLookup.ref];

  if (ref.type === ARRAY_CELL) {
    return { lookupIndex: { value: ref.index }, on: { ref: ref.arrayId } };
  }
  if (ref.type === OBJECT_CELL) {
    return { lookup: ref.name, on: { ref: ref.objectId } };
  }
  if (ref.type === TABLE_ROW) {
    return { lookupIndex: { value: ref.index }, on: { ref: ref.tableId } };
  }
  if (ref.type === TABLE_COLUMN || ref.type === COMPUTED_TABLE_COLUMN) {
    return { lookup: ref.name, on: { ref: ref.tableId } };
  }
  if (ref.type === TABLE_CELL) {
    const arrayParent = refsById[ref.arrayId];
    return { lookup: arrayParent.name, on: { ref: ref.objectId } };
  }
  if (![CELL, ARRAY, OBJECT, TABLE].includes(ref.type)) {
    throw new Error(`unknown parent type for ${ref.type}`);
  }
  return { lookup: ref.name, on: { ref: ref.sheetId } };
};


export const lookupExpression = (refsById, contextRefId, targetRefId) => {
  // We might "statically resolve" foo.bar[12] to a particular table cell
  // (and not depend on the whole column `bar` being evaluated first.)
  // This function turns a formula { ref } to that cell into a bunch of
  // index- and name-lookups.
  // This is kinda the opposite of the "subNames" procedure when parsing.
  let sourceContextRef = refsById[contextRefId];
  let targetContextRef = refsById[refParentId(refsById[targetRefId])];

  // Kinda ugly: The "rewrite" function replaces the `on` property with
  // a different `on` property. We return `ret.on` at the end.
  const ret = { on: { ref: targetRefId } };

  let innermostLookup = ret;
  while (refHeight(targetContextRef) > refHeight(sourceContextRef)) {
    // If we are a table-cell, the table-context will need to be provided
    // to anyone in a sheet
    innermostLookup.on = rewriteRefTermToParentLookup(
      refsById,
      innermostLookup.on,
    );
    innermostLookup = innermostLookup.on;
    targetContextRef = refsById[refParentId(targetContextRef)];
  }
  while (refHeight(sourceContextRef) > refHeight(targetContextRef)) {
    // Other people's table context won't be useful to qualify a reference
    // to us if we're just a cell in a sheet.
    sourceContextRef = refsById[refParentId(sourceContextRef)];
  }
  while (targetContextRef !== sourceContextRef) {
    // Similar levels of context, but "far" from each other.
    innermostLookup.on = rewriteRefTermToParentLookup(
      refsById,
      innermostLookup.on,
    );
    innermostLookup = innermostLookup.on;
    targetContextRef = refsById[refParentId(targetContextRef)];
    sourceContextRef = refsById[refParentId(sourceContextRef)];
  }
  return ret.on;
};


// Formula translation functions: Generic ways to iterate over a forumla's
// contents, applying a function to every element from the leaves up.

// NOTE: We might want to let people refer to table columns by name (and
// without reference to the sheet) from within the table, and similarly
// object fields from within objects, but nto sure how to at the moment.
// The problems are around what to do with unmatched names  when we finish
// literal expansion.
// Also: `col[0]` from within a table breaks our preferred pattern of
// `table[0].col`. Not sure what to do about that, tbh.
const isContext = type => type === SHEET;

export const getContextIdForRefId = (refsById, refId, defaultContextId) => {
  let maybeContext = refsById[refId];
  while (maybeContext && !isContext(maybeContext.type)) {
    maybeContext = refsById[refParentId(maybeContext)];
  }
  if (!maybeContext) return defaultContextId;
  return maybeContext.id;
};


const isGlobalCall = (preTranslate, postTranslate) => {
  if (postTranslate.name) {
    const maybeName = postTranslate.name;
    return (maybeName in globalFunctions) && maybeName;
  }
  const maybeName = preTranslate.name;
  return (maybeName in globalFunctions) && maybeName;
};

const callRef = (preTranslate, postTranslate) => {
  // Sometimes we're translating names -> refs, sometimes we are
  // translating refs -> printable strings etc. One of them should have a
  // reference...
  if (postTranslate.ref) return postTranslate.ref;
  return preTranslate.ref;
};


// Term-rewriting, more or less. The function argument "transforms" the
// term, but can be a closure that just logs it or whatever instead etc.
export const translateExpr = (...fnArgs) => {
  let outerTerm, outerContextId, f, state;
  if (fnArgs.length === 4) {
    [outerTerm, outerContextId, state, f] = fnArgs;
  } else if (fnArgs.length === 3) {
    [outerTerm, state, f] = fnArgs;
  } else if (fnArgs.length === 2) {
    [outerTerm, f] = fnArgs;
  }

  const refsById = state && getRefsById(state);

  const getCallContextId = (preTranslate, postTranslate, fallback) => {
    if (!state) return outerContextId;
    const globalCall = isGlobalCall(preTranslate, postTranslate);
    if (globalCall) return globalCall;
    return getContextIdForRefId(
      refsById,
      callRef(postTranslate, preTranslate),
      fallback,
    );
  };

  const doCall = (term, contextId) => {
    const call = doExpr(term.call, contextId);
    const callContextId = getCallContextId(term.call, call, contextId);

    const args = term.args.map(expr => (
      doExpr(expr, contextId)));
    const kwargs = term.kwargs.map(({ ref, expr }) => ({
      ref: doExpr(ref, callContextId),
      expr: doExpr(expr, contextId),
    }));
    return f({ call, args, kwargs }, contextId, state);
  };

  const doLookup = (term, contextId) => {
    const on = doExpr(term.on, contextId);
    return f({ lookup: term.lookup, on }, contextId, state);
  };

  const doLookupIndex = (term, contextId) => {
    const lookupIndex = doExpr(term.lookupIndex, contextId);
    const on = doExpr(term.on, contextId);
    return f({ lookupIndex, on }, contextId, state);
  };

  const doArray = (term, contextId) => {
    const array = term.array.map(t => doExpr(t, contextId));
    return f({ array }, contextId, state);
  };

  const doObject = (term, contextId) => {
    const object = term.object.map(({ key, value }) => ({
      key,
      value: doExpr(value, contextId),
    }));
    return f({ object }, contextId, state);
  };

  const doIndexLookup = (term, contextId) => {
    const indexLookup = doExpr(term.indexLookup, contextId);
    const on = doExpr(term.on, contextId);
    const keyCol = doExpr(term.keyCol, contextId);
    return f({ indexLookup, on, keyCol }, contextId, state);
  };

  const doExpr = (term, contextId) => {
    if (term.lookup) return doLookup(term, contextId);
    if ('lookupIndex' in term) return doLookupIndex(term, contextId);
    if (term.indexLookup) return doIndexLookup(term, contextId);
    if (term.name || term.ref) return f(term, contextId, state);
    if ('value' in term || term.op) return f(term, contextId, state);
    if (term.call) return doCall(term, contextId);
    if (term.unary) {
      return f(
        { unary: term.unary, on: doExpr(term.on, contextId) },
        contextId,
        state,
      );
    }
    if (term.array) return doArray(term, contextId);
    if (term.object) return doObject(term, contextId);
    if (term.binary) {
      return f(
        {
          binary: term.binary,
          left: doExpr(term.left, contextId),
          right: doExpr(term.right, contextId),
        },
        contextId,
        state,
      );
    }
    if (term.expression) {
      return f(
        { expression: doExpr(term.expression, contextId) },
        contextId,
        state,
      );
    }
    if (term.badFormula) return f(term, contextId, state);
    throw new Error('Unknown term type');
  };

  return doExpr(outerTerm, outerContextId);
};


export const runTranslations = (...fnArgs) => {
  let term = fnArgs[0];
  fnArgs[fnArgs.length - 1].forEach((f) => {
    term = translateExpr(...[term, ...fnArgs.slice(1, -1), f]);
  });
  return term;
};

export const flattenExpr = (expr) => {
  // Get every element inside the formula (not just leaves)
  const ret = [];
  translateExpr(expr, (term) => {
    if (term === undefined) {
      throw new Error('ahoy!');
    }
    ret.push(term);
    return term;
  });
  return ret;
};

const refErrorMessage = name => `(${JSON.stringify(name)} + ' does not exist.')`;

export const refError = (refsById, term, contextId) => {
  if (term.badFormula) return { str: '"Bad formula"' };
  if (term.name) {
    if (term.name in globalFunctions) return false;
    if (contextId in globalFunctions && globalFunctionArgs[contextId].has(term.name)) {
      return false;
    }
    return { str: refErrorMessage(term.name) };
  }
  if (term.lookup && term.on.ref) {
    // Unresolved lookups are bad on sheets and "static" objects, but fine
    // on computed cells etc.
    const ref = refsById[term.on.ref];
    if (!ref.formula) {
      return { str: refErrorMessage(term.lookup), ref: term.on.ref };
    }
  }
  return false;
};

export const computedColumnsByTableId = createSelector(
  getRefs,
  (refs) => {
    const ret = {};
    refs.forEach((ref) => { ret[ref.id] = []; });
    refs.forEach((ref) => {
      if (ref.type === COMPUTED_TABLE_COLUMN) {
        ret[ref.tableId].push(ref);
      }
    });
    return ret;
  },
);

const refEdges = (ref, refsById, childIdsByParentId, computedColsByTableId) => {
  if (ref.formula) {
    const errorRefs = new Set();
    translateExpr(ref.formula, (term, contextId) => {
      const err = refError(refsById, term, contextId);
      if (err && err.ref) errorRefs.add(err.ref);
      return term;
    });
    return flattenExpr(ref.formula)
      .filter(term => term.ref && !errorRefs.has(term.ref))
      .map(term => term.ref);
  }
  const children = childIdsByParentId[ref.id];
  if (ref.type !== TABLE_ROW) return children;

  // Each table row in a table depends on the computed columns in the table
  // being computed (so we can steal elements from them)
  const myComputedCols = computedColsByTableId[ref.tableId];
  const computedColumnIds = myComputedCols.map(({ id }) => id);
  return [...children, ...computedColumnIds];
};

// Predecessor/successor relations in the formula/computation graph.
export const getFormulaGraphs = createSelector(
  getRefs,
  getRefsById,
  getChildIdsByParentId,
  computedColumnsByTableId,
  (refs, refsById, childIdsByParentId, computedColsByTableId) => {
    const forwardsGraph = {};
    const backwardsGraph = {};
    refs.forEach(({ id }) => {
      forwardsGraph[id] = [];
      backwardsGraph[id] = [];
    });
    refs.forEach((ref) => {
      refEdges(
        ref,
        refsById,
        childIdsByParentId,
        computedColsByTableId,
      ).forEach((jNodeId) => {
        forwardsGraph[ref.id].push(jNodeId);
        backwardsGraph[jNodeId].push(ref.id);
      });
    });
    return {
      forwardsGraph, // keys depend on values
      backwardsGraph, // values depend on keys
    };
  },
);


const circularRefs = createSelector(
  getRefsById,
  getFormulaGraphs,
  (refsById, { backwardsGraph, forwardsGraph }) => {
    const circularRefRefIds = nodesInLargeStronglyConnectedComponents(
      forwardsGraph,
      backwardsGraph,
    );
    const ret = new Set();
    circularRefRefIds.forEach((refId) => {
      if (refsById[refId].formula) ret.add(refId);
    });
    return ret;
  },
);


// Array of thing-ids in "compute-order". Things involved in circular ref
// problems are omitted for now.
export const getTopoSortedRefIds = createSelector(
  getFormulaGraphs,
  circularRefs,
  ({ backwardsGraph }, badRefs) => topologicalOrdering(
    backwardsGraph,
    badRefs,
  ),
);

// id -> order location. If ret[myId] < ret[yourId], your object definitely
// does not depend on mine.
export const getTopoLocationById = createSelector(
  getTopoSortedRefIds,
  (ordering) => {
    const ret = {};
    ordering.forEach((id, index) => { ret[id] = index; });
    return ret;
  },
);
