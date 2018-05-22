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

const expandSetItem = (k, expr) =>
  `try {
    globals[${JSON.stringify(k)}] = {
      value: ${expr}, override: false };
  } catch (e) {
    globals[${JSON.stringify(k)}] = { error: e.toString() };
  }`;

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

const expandExpr = (term) => {
  if (term.lookup) return expandLookup(term);
  if (term.lookupIndex) return expandLookupIndex(term);
  if (term.ref) return expandRef(term);
  if (term.call) return expandCall(term);
  if (term.op) return term.op;
  if ('value' in term) return JSON.stringify(term.value);
  if (term.expression) return `(${expandExpr(term.expression)})`;
  if (term.unary) return `${term.unary}${expandExpr(term.on)}`;
  if (term.binary) return `${expandExpr(term.left)} ${term.binary} ${expandExpr(term.right)}`;
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

// Make a literal struct from a sheet's cells.
const sheetValue = (sheetId, globals) => {
  const sheetCells = getChildrenOfRef(store.getState(), sheetId);
  const ret = {
    byId: {},
    byName: {},
    template: sheetId,
  };
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
