import { createSelector } from 'reselect';
import {
  flattenExpr,
  getFormulaGraphs,
  getTopoLocationById,
  getRefs,
  getChildrenOfRef,
  getTopoSortedRefIds,
  refError,
} from './selectors';
import { setIntersection, transitiveClosure } from '../algorithms/algorithms';
import store, { ARRAY, SHEET } from '../../redux/store';
import { getNamedMember, getNumberedMember, TableArray } from './tables';

// Functions to translate into formulas into code to be evaluated

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

const expandExpr = (expr) => {
  const expandedTerms = expr.map(term =>
    expandTerm(term));
  return expandedTerms.join(' ');
};

const expandRef = term => `globals.formulaRef(globals, ${JSON.stringify(term.ref)})`;

const expandLookup = (term) => {
  const expandedOn = expandTerm(term.on);
  return `globals.getNamedMember(${expandedOn}, ${JSON.stringify(term.lookup)})`;
};

const expandLookupIndex = (term) => {
  const expandedOn = expandTerm(term.on);
  const expandedIndex = expandExpr(term.lookupIndex);
  return `globals.getNumberedMember(${expandedOn}, ${expandedIndex})`;
};

const expandTerm = (term) => {
  if (term.lookup) return expandLookup(term);
  if (term.lookupIndex) return expandLookupIndex(term);
  if (term.ref) return expandRef(term);
  if (term.call) return expandCall(term);
  if (term.op) return term.op;
  if ('value' in term) return JSON.stringify(term.value);
  if (term.expression) return `(${expandExpr(term.expression)})`;
  if (term.unary) return `${term.unary}${expandTerm(term.on)}`;
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


// Get the "top of stack" value/error for a ref
const getRef = (globals, ref) => {
  const values = globals[ref];
  return values[values.length - 1];
};

// Unwrap a "ref at rest" into a "value in flight or exception"
const formulaRef = (globals, ref) => {
  const ret = getRef(globals, ref);
  if ('value' in ret) return ret.value;
  throw new Error(ret.error);
};

// Make a literal struct from a sheet's cells.
const sheetValue = (sheetId, globals) => {
  const sheetCells = getChildrenOfRef(store.getState(), sheetId);
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

const arrayValue = (arrayId, globals) => {
  const arrayCells = getChildrenOfRef(store.getState(), arrayId);
  const storage = new Array(arrayCells.length);
  arrayCells.forEach(({ index, id }) => {
    storage[index] = getRef(globals, id);
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
    return `pleaseThrow(${termErrors[0]})`;
  }
  return expandExpr(formula);
};

const refExpression = (ref) => {
  if (ref.type === SHEET) {
    return `globals.sheetValue(${JSON.stringify(ref.id)}, globals)`;
  }
  if (ref.type === ARRAY) {
    return `globals.arrayValue(${JSON.stringify(ref.id)}, globals)`;
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
    };

    // Initialize circular refs and things that depend on them.
    refs.forEach(({ id }) => {
      globals[id] = [{ error: 'Error: Circular reference (or depends on one)' }];
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
    return getGlobalValues(globals, refs);
  },
);

// Translates the computation data into something more palatable for UI
// consumption. No more stacks, mostly.
const getGlobalValues = (globals, refs) => {
  const ret = {};
  refs.forEach(({ id }) => { ret[id] = getRef(globals, id) });
  return ret;
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

// Actually building the code to eval and making a real function.
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
