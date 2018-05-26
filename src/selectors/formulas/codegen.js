import { createSelector } from 'reselect';
import {
  flattenExpr,
  getFormulaGraphs,
  getTopoLocationById,
  getRefs,
  getRefsById,
  getChildrenOfRef,
  getTopoSortedRefIds,
  refError,
} from './selectors';
import { setIntersection, transitiveClosure } from '../algorithms/algorithms';
import store, { ARRAY, OBJECT, SHEET, TABLE, TABLE_COLUMN, TABLE_ROW } from '../../redux/store';
import { getNamedMember, getNumberedMember, TableArray } from './tables';
import builtins, { binarySymbolToName, unarySymbolToName } from './builtins';

// Functions to translate into formulas into code to be evaluated
// We don't use `translateExpr`, mostly I think (?) because we need to
// evaluate `callSignature`. I could be wrong, though...

const expandSetItem = (k, expr) =>
  `try {
    globals[${JSON.stringify(k)}] = {
      value: ${expr}, override: false };
  } catch (e) {
    globals[${JSON.stringify(k)}] = { error: e.toString() };
  }`;

const tryExpandExpr = expr =>
  `(() => {
     try { return { value: ${expandExpr(expr)} }; }
     catch (e) { return { error: e.toString()}; }
   })()`;

const expandCall = (callTerm) => {
  const signature = callSignature(callTerm);
  if (!callTerm.args.every(({ ref }) => ref.ref)) {
    return 'pleaseThrow("Call arguments must be plain references")';
  }
  const customArgs = callTerm.args.map(({ expr }) =>
    expandExpr(expr));
  const allArgs = [
    'globals',
    ...customArgs,
  ].join(', ');
  return `globals[${JSON.stringify(signature)}](${allArgs})`;
};

const expandRef = term => `globals.formulaRef(globals, ${JSON.stringify(term.ref)})`;

const expandLookup = (term) => {
  const expandedOn = expandExpr(term.on);
  return `globals.getNamedMember(${expandedOn}, ${JSON.stringify(term.lookup)})`;
};

const expandLookupIndex = (term) => {
  const expandedOn = expandExpr(term.on);
  const expandedIndex = expandExpr(term.lookupIndex);
  return `globals.getNumberedMember(${expandedOn}, ${expandedIndex})`;
};

const expandUnary = (term) => {
  const func = `globals.${unarySymbolToName[term.unary]}`;
  return `${func}(${expandExpr(term.on)})`;
};

const expandBinary = (term) => {
  const func = `globals.${binarySymbolToName[term.binary]}`;
  return `${func}(${expandExpr(term.left)}, ${expandExpr(term.right)})`;
};

const expandArray = (term) => {
  const expandedArgs = term.array.map(e => tryExpandExpr(e));
  const joinedArgs = expandedArgs.join(',');
  return `globals.tableArray([${joinedArgs}])`;
};

const expandObject = (term) => {
  const translatedElems = term.object.map(({ key, value }) => {
    const expandedValue = tryExpandExpr(value);
    return `${JSON.stringify(key)}: ${expandedValue}`;
  }).join(',');
  return `{ byName: { ${translatedElems} } }`;
};

const expandExpr = (term) => {
  if (term.lookup) return expandLookup(term);
  if (term.lookupIndex) return expandLookupIndex(term);
  if (term.ref) return expandRef(term);
  if (term.call) return expandCall(term);
  if (term.op) return term.op;
  if ('value' in term) return JSON.stringify(term.value);
  if (term.expression) return `(${expandExpr(term.expression)})`;
  if (term.unary) return expandUnary(term);
  if (term.binary) return expandBinary(term);
  if (term.array) return expandArray(term);
  if (term.object) return expandObject(term);
  throw new Error(`unknown term type ${JSON.stringify(term)}`);
};


// Distinct spreadsheet "what-if" "calls" are translated into JS functions.
// We store them based on input and output ref ids.
const callSignature = (callTerm) => {
  if (!callTerm.call.ref) {
    throw new Error('Can only call refs');
  }
  const argRefs = callTerm.args.map(({ ref }) => ref.ref);
  const joinedRefs = argRefs.join(',');
  return `${callTerm.call.ref}(${joinedRefs})`;
};

// Functions used in formula evaluation.
// A note on the value/storage model:
//  - A cell's evaluation can either result in a value being produced or
//    an error being raised. Data "at rest" is either tagged as a value
//    or an error.
//  - Data "in flight" is all just values (because exceptions flow out of
//    band of the code we generate.)
//  - Functions like `iferror` and `iserror` will need to be macros or
//    something, probably :/
//
// A note on the function evaluation model:
//  - We have a stack of values (or errors) for every reference. The first
//    element is normally the "actual" value of the ref, subsequent values
//    are pushed/popped/used in "what-if" function calls.


// Unwrap a "ref at rest" into a "value in flight or exception"
const formulaRef = (globals, ref) => {
  const ret = globals[ref];
  if ('value' in ret) return ret.value;
  throw new Error(ret.error);
};

const tableArray = arr => new TableArray(arr);

// Make a literal struct from a sheet's cells.
const sheetValue = (sheetId, globals, includeTemplate) => {
  const sheetCells = getChildrenOfRef(store.getState(), sheetId);
  const ret = {
    byId: {},
    byName: {},
  };
  if (includeTemplate) ret.template = sheetId;
  sheetCells.forEach(({ id, name }) => {
    const cellContents = globals[id];
    ret.byId[id] = cellContents;
    ret.byName[name] = cellContents;
  });
  return ret;
};

const arrayValue = (arrayId, globals) => {
  const arrayCells = getChildrenOfRef(store.getState(), arrayId);
  const storage = new Array(arrayCells.length);
  arrayCells.forEach(({ index, id }) => {
    storage[index] = globals[id];
  });
  return new TableArray(storage);
};

const tableValue = (tableId, globals) => {
  const tableCells = getChildrenOfRef(store.getState(), tableId)
    .filter(({ type }) => type === TABLE_ROW);
  const storage = new Array(tableCells.length);
  tableCells.forEach(({ index, id }) => {
    storage[index] = globals[id];
  });
  const ret = new TableArray(storage);

  const tableCols = getChildrenOfRef(store.getState(), tableId)
    .filter(({ type }) => type === TABLE_COLUMN);
  ret.keys = [];
  tableCols.forEach(({ index, name }) => { ret.keys[index] = name; });
  return ret;
};

const tableRowValue = (tableRowId, globals) => {
  const ret = {
    byId: {},
    byName: {},
  };
  const refsById = getRefsById(store.getState());
  const tableRowCells = getChildrenOfRef(store.getState(), tableRowId);
  tableRowCells.forEach(({ id, arrayId }) => {
    const cellContents = globals[id];
    const { name } = refsById[arrayId];
    ret.byId[id] = cellContents;
    ret.byName[name] = cellContents;
  });
  return ret;
};

const tableColumnValue = (tableColumnId, globals) => {
  const columnCells = getChildrenOfRef(store.getState(), tableColumnId);
  const refsById = getRefsById(store.getState());
  const storage = new Array(columnCells.length);
  columnCells.forEach(({ id, objectId }) => {
    const { index } = refsById[objectId];
    storage[index] = globals[id];
  });
  return new TableArray(storage);
};

// eslint-disable-next-line no-unused-vars
const pleaseThrow = (s) => { throw new Error(s); };

const formulaExpression = (formula) => {
  const allTerms = flattenExpr(formula);
  const termErrors = allTerms
    .map(term => refError(term))
    .filter(Boolean);
  if (termErrors.length > 0) {
    return `pleaseThrow(${termErrors[0].str})`;
  }
  return expandExpr(formula);
};

const refExpression = (ref) => {
  // TODO: Maybe we should store lists of children in globals so sheetValue
  // etc don't have to read redux data.
  if (ref.type === SHEET || ref.type === OBJECT) {
    return `globals.sheetValue(${JSON.stringify(ref.id)}, globals, ${ref.type === SHEET})`;
  }
  if (ref.type === ARRAY) {
    return `globals.arrayValue(${JSON.stringify(ref.id)}, globals)`;
  }
  if (ref.type === TABLE_ROW) {
    return `globals.tableRowValue(${JSON.stringify(ref.id)}, globals)`;
  }
  if (ref.type === TABLE_COLUMN) {
    return `globals.tableColumnValue(${JSON.stringify(ref.id)}, globals)`;
  }
  if (ref.type === TABLE) {
    return `globals.tableValue(${JSON.stringify(ref.id)}, globals)`;
  }
  if (!ref.formula) {
    throw new Error(`unknown object type ${ref.type}`);
  }
  return formulaExpression(ref.formula);
};

const getRefExpressions = (refs) => {
  const ret = {};
  refs.forEach((ref) => {
    ret[ref.id] = refExpression(ref);
  });
  return ret;
};

// eslint-disable-next-line import/prefer-default-export
export const getCellValuesById = createSelector(
  getRefs,
  getTopoSortedRefIds,
  (refs, sortedRefIds) => {
    const globals = {
      arrayValue,
      getNamedMember,
      getNumberedMember,
      formulaRef,
      sheetValue,
      pleaseThrow,
      tableArray,
      tableValue,
      tableRowValue,
      tableColumnValue,
      ...builtins,
    };

    // Initialize circular refs and things that depend on them.
    refs.forEach(({ id }) => {
      globals[id] = { error: 'Error: Circular reference (or depends on one)' };
    });

    // All expressions for cells and sheets
    const refExpressions = getRefExpressions(refs);

    // Write all functions
    const allFormulas = refs.map(({ formula }) => formula).filter(Boolean);
    const allTerms = [].concat(...allFormulas.map(flattenExpr));
    const allCalls = allTerms.filter(({ call }) => !!call);
    allCalls.forEach((callTerm) => {
      const signature = callSignature(callTerm);
      if (globals[signature]) return;
      globals[signature] = createFunction(callTerm, refExpressions);
    });

    // Evaluate every cell.
    sortedRefIds.forEach((id) => {
      // eslint-disable-next-line no-eval
      eval(expandSetItem(id, refExpressions[id]));
    });
    return globals;
  },
);

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

class RefPusher {
  constructor() {
    this.setStatements = [];
    this.unsetStatements = [];
  }

  variableName() { return `v${this.unsetStatements.length}`; }

  expandOverride(id) {
    const localVariable = this.variableName();
    this.setStatements.push(`globals["${id}"] = { value: ${localVariable}, override: true };`);
    this.unsetStatements.push(`globals["${id}"] = ${localVariable};`);
  }

  expandSetItem(id, expr) {
    const localVariable = this.variableName();
    this.setStatements.push(`const ${localVariable} = globals["${id}"];`);
    this.setStatements.push(expandSetItem(id, expr));
    this.unsetStatements.push(`globals["${id}"] = ${localVariable};`);
  }
}

// Actually building the code to eval and making a real function.
const createFunction = (callTerm, refExpressions) => {
  const refPusher = new RefPusher();
  // Set overrides
  callTerm.args.forEach(({ ref }) => {
    refPusher.expandOverride(ref.ref);
  });

  // Run dependent cells
  functionCellsInOrder(callTerm).forEach((id) => {
    refPusher.expandSetItem(id, refExpressions[id]);
  });

  // Construct the function
  const functionDefinition = [
    ...refPusher.setStatements,
    `const ret = ${refExpressions[callTerm.call.ref]};`,
    ...refPusher.unsetStatements,
    'return ret;',
  ].join('\n');

  const argNames = callTerm.args.map((arg, i) => `v${i}`);
  // eslint-disable-next-line no-new-func
  return Function('globals', ...argNames, functionDefinition);
};
