import store from '../../redux/store';

import {
  getRefsById,
  lookupExpression,
  refParentId,
  translateExpr,
} from './selectors';

// Turning a stored raw formula back into a string.

const unparseRef = (id) => {
  const ref = getRefsById(store.getState())[id];
  if (!ref || !ref.name) throw new Error('ugh');
  return ref.name;
};

export const unparseTerm = (term) => {
  if (term.lookup) return `${term.on}.${term.lookup}`;
  if (term.lookupIndex) {
    const args = term.lookupIndex.join(' ');
    return `${term.on}[${args}]`;
  }
  if (term.call) {
    const argsText = term.args
      .map(({ ref, expr }) => `${ref}=${expr.join(' ')}`)
      .join(', ');
    return `${term.call}(${argsText})`;
  }
  if (term.expression) return `(${term.expression.join(' ')})`;
  if (term.badFormula) return term.badFormula;
  if (term.op) return term.op;
  if (term.ref) return unparseRef(term.ref);
  if (term.name) return term.name;
  if ('value' in term) return JSON.stringify(term.value);
  throw new Error('Unknown term type');
};

const subRefsForLookupsInTerm = (term, contextId) => {
  if (term.ref) return lookupExpression(contextId, term.ref);
  return term;
};

export const stringFormula = (refId) => {
  const ref = getRefsById(store.getState())[refId];
  if (!ref) return '';
  if (!ref.formula) throw new Error(`Tried to get string formula for bad type: ${ref.type}`);

  const retToJoin = [];
  if (ref.name) {
    retToJoin.push(ref.name);
  }
  retToJoin.push('=');
  const lookupTerms = translateExpr(
    ref.formula,
    refParentId(ref.id),
    subRefsForLookupsInTerm,
  );
  const terms = translateExpr(lookupTerms, null, unparseTerm);
  return [...retToJoin, ...terms].join(' ');
};
