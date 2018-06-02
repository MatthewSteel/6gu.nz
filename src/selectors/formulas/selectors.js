import { createSelector } from 'reselect';
import {
  topologicalOrdering,
  transitiveClosure,
  nodesInLargeStronglyConnectedComponents,
} from '../algorithms/algorithms';
import { globalFunctions, globalFunctionArgs } from './builtins';
import store, { ARRAY, ARRAY_CELL, CELL, OBJECT, OBJECT_CELL, SHEET, TABLE, TABLE_CELL, COMPUTED_TABLE_COLUMN, TABLE_COLUMN, TABLE_ROW } from '../../redux/store';

// Simple "get raw state" selectors (for the moment?)

export const getCells = state => state.cells;
export const getSheets = state => state.sheets;

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

export const transitiveChildren = (refId) => {
  // Sheet -> table -> cell etc. Not formula references.
  const childrenByParentId = getChildIdsByParentId(store.getState());
  const descendants = transitiveClosure([refId], childrenByParentId);
  descendants.add(refId);
  return descendants;
};

export const externalFacingDescendants = (refId) => {
  if (refId === undefined) return []; // Ugh, bad "call" arguments...
  const descendants = transitiveChildren(refId);
  const { backwardsGraph } = getFormulaGraphs(store.getState());
  const ret = new Set([refId]);
  descendants.forEach((descendantId) => {
    backwardsGraph[descendantId].forEach((referrerId) => {
      if (!descendants.has(referrerId)) ret.add(descendantId);
    });
  });
  return [...ret];
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

export const refIdParentId = (refId) => {
  const refsById = getRefsById(store.getState());
  return refParentId(refsById[refId]);
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

export const rewriteRefTermToParentLookup = (innermostLookup) => {
  if (!innermostLookup.ref) throw new Error('Must pass lookup on `refId`');
  const refsById = getRefsById(store.getState());
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


export const lookupExpression = (contextRefId, targetRefId) => {
  // We might "statically resolve" foo.bar[12] to a particular table cell
  // (and not depend on the whole column `bar` being evaluated first.)
  // This function turns a formula { ref } to that cell into a bunch of
  // index- and name-lookups.
  // This is kinda the opposite of the "subNames" procedure when parsing.
  const refsById = getRefsById(store.getState());
  let sourceContextRef = refsById[contextRefId];
  let targetContextRef = refsById[refIdParentId(targetRefId)];

  // Kinda ugly: The "rewrite" function replaces the `on` property with
  // a different `on` property. We return `ret.on` at the end.
  const ret = { on: { ref: targetRefId } };

  let innermostLookup = ret;
  while (refHeight(targetContextRef) > refHeight(sourceContextRef)) {
    // If we are a table-cell, the table-context will need to be provided
    // to anyone in a sheet
    innermostLookup.on = rewriteRefTermToParentLookup(innermostLookup.on);
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
    innermostLookup.on = rewriteRefTermToParentLookup(innermostLookup.on);
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

export const getContextIdForRefId = (refId, defaultContextId) => {
  const refsById = getRefsById(store.getState());
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


const translateCall = (term, contextId, f) => {
  const call = translateExpr(term.call, contextId, f);
  const globalCall = isGlobalCall(term.call, call);
  const callContextId = globalCall || getContextIdForRefId(callRef(term.call, call), contextId);
  const args = term.args.map(expr => (
    translateExpr(expr, contextId, f)));
  const kwargs = term.kwargs.map(({ ref, expr }) => ({
    ref: translateExpr(ref, callContextId, f),
    expr: translateExpr(expr, contextId, f),
  }));
  return f({ call, args, kwargs }, contextId);
};

const translateLookup = (term, contextId, f) => {
  const on = translateExpr(term.on, contextId, f);
  return f({ lookup: term.lookup, on }, contextId);
};


const translateLookupIndex = (term, contextId, f) => {
  const lookupIndex = translateExpr(term.lookupIndex, contextId, f);
  const on = translateExpr(term.on, contextId, f);
  return f({ lookupIndex, on }, contextId);
};

const translateArray = (term, contextId, f) => {
  const array = term.array.map(t => translateExpr(t, contextId, f));
  return f({ array }, contextId);
};

const translateObject = (term, contextId, f) => {
  const object = term.object.map(({ key, value }) => ({
    key,
    value: translateExpr(value, contextId, f),
  }));
  return f({ object }, contextId);
};

const translateIndexLookup = (term, contextId, f) => {
  const indexLookup = translateExpr(term.indexLookup, contextId, f);
  const on = translateExpr(term.on, contextId, f);
  const keyCol = translateExpr(term.keyCol, contextId, f);
  return f({ indexLookup, on, keyCol }, contextId, f);
};

export const translateExpr = (term, contextId, f) => {
  if (term.lookup) return translateLookup(term, contextId, f);
  if ('lookupIndex' in term) return translateLookupIndex(term, contextId, f);
  if (term.indexLookup) return translateIndexLookup(term, contextId, f);
  if (term.name || term.ref) return f(term, contextId);
  if ('value' in term || term.op) return f(term, contextId);
  if (term.call) return translateCall(term, contextId, f);
  if (term.unary) {
    return f(
      { unary: term.unary, on: translateExpr(term.on, contextId, f) },
      contextId,
    );
  }
  if (term.array) return translateArray(term, contextId, f);
  if (term.object) return translateObject(term, contextId, f);
  if (term.binary) {
    return f(
      {
        binary: term.binary,
        left: translateExpr(term.left, contextId, f),
        right: translateExpr(term.right, contextId, f),
      },
      contextId,
    );
  }
  if (term.expression) {
    return f(
      { expression: translateExpr(term.expression, contextId, f) },
      contextId,
    );
  }
  if (term.badFormula) return f(term, contextId);
  throw new Error('Unknown term type');
};

export const runTranslations = (input, contextId, fs) => {
  let term = input;
  fs.forEach((f) => { term = translateExpr(term, contextId, f); });
  return term;
};

export const flattenExpr = (expr) => {
  // Get every element inside the formula (not just leaves)
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

const refErrorMessage = name => `(${JSON.stringify(name)} + ' does not exist.')`;

export const refError = (term, contextId) => {
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
    const ref = getRefsById(store.getState())[term.on.ref];
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

const refEdges = (ref) => {
  if (ref.formula) {
    const errorRefs = new Set();
    translateExpr(ref.formula, null, (term, contextId) => {
      const err = refError(term, contextId);
      if (err && err.ref) errorRefs.add(err.ref);
      return term;
    });
    return flattenExpr(ref.formula)
      .filter(term => term.ref && !errorRefs.has(term.ref))
      .map(term => term.ref);
  }
  const children = getChildIdsByParentId(store.getState())[ref.id];
  if (ref.type !== TABLE_ROW) return children;

  // Each table row in a table depends on the computed columns in the table
  // being computed (so we can steal elements from them)
  const allComputedCols = computedColumnsByTableId(store.getState());
  const computedColumnIds = allComputedCols[ref.tableId].map(({ id }) => id);
  return [...children, ...computedColumnIds];
};

// Predecessor/successor relations in the formula/computation graph.
export const getFormulaGraphs = createSelector(
  getRefs,
  (refs) => {
    const forwardsGraph = {};
    const backwardsGraph = {};
    refs.forEach(({ id }) => {
      forwardsGraph[id] = [];
      backwardsGraph[id] = [];
    });
    refs.forEach((ref) => {
      refEdges(ref).forEach((jNodeId) => {
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
