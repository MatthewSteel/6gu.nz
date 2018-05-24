import { TableArray } from './tables';
// Built-in functions and operators
const NUMBER = 0;
const STRING = 1;
const BOOL = 2;
const NULL = 3;
const ARRAY = 4;
const OBJECT = 5;

const classify = (o) => {
  const t = typeof o;
  if (t === 'object') {
    if (o.byName) return OBJECT;
    if (o.arr) return ARRAY;
    if (!o) return NULL;
    console.log(o);
    throw new Error('bad type');
  }
  return {
    boolean: BOOL,
    number: NUMBER,
    string: STRING,
  }[t];
};

export const op2 = (op) => {
  const tryF = (leftElem, rightElem) => {
    if (leftElem.error) return leftElem;
    if (rightElem.error) return rightElem;
    return { value: f(leftElem.value, rightElem.value) };
  };

  const f = (left, right) => {
    const type1 = classify(left);
    const type2 = classify(right);
    // TODO: Some switch on a bitmask, I think.
    // Also: Consider getting rid of errors...
    if (type1 === ARRAY && type2 === ARRAY) {
      if (left.arr.length !== right.arr.length) {
        if (left.arr.length === 1) {
          const leftElem = left.arr[0];
          return new TableArray(right.arr.map((
            rightElem => tryF(leftElem, rightElem))));
        }
        if (right.arr.length === 1) {
          const rightElem = right.arr[0];
          return new TableArray(left.arr.map((
            leftElem => tryF(leftElem, rightElem))));
        }
        throw new Error('Mismatched array lengths');
      }
      return new TableArray(left.arr.map((leftElem, i) => {
        const rightElem = right.arr[i];
        return tryF(leftElem, rightElem);
      }));
    }
    if (type1 === ARRAY) {
      return new TableArray(left.arr.map((
        leftElem => tryF(leftElem, { value: right }))));
    }
    if (type2 === ARRAY) {
      return new TableArray(right.arr.map((
        rightElem => tryF({ value: left }, rightElem))));
    }
    if (type1 === OBJECT || type2 === OBJECT) {
      throw new Error('Binary op not supported for objects');
    }
    return op(left, right);
  };
  return f;
};

export const op1 = (op) => {
  const f = (right) => {
    const type1 = classify(right);
    if (type1 === OBJECT) {
      throw new Error('Unary op not supported for objects');
    }
    if (type1 === ARRAY) {
      return new TableArray(right.arr.map((elem) => {
        if (elem.error) return elem;
        return { value: f(elem.value) };
      }));
    }
    return op(right);
  };
  return f;
};

const plus = op2((l, r) => l + r);
const minus = op2((l, r) => l - r);
const times = op2((l, r) => l * r);
const divide = op2((l, r) => l / r);
const mod = op2((l, r) => l % r);
const pow = op2((l, r) => l ** r);
const eq = op2((l, r) => l === r);
const ne = op2((l, r) => l !== r);
const ge = op2((l, r) => l >= r);
const gt = op2((l, r) => l > r);
const le = op2((l, r) => l <= r);
const lt = op2((l, r) => l < r);
const lshift = op2((l, r) => l << r);
const rshift = op2((l, r) => l >> r);
const logicalAnd = op2((l, r) => l && r);
const logicalOr = op2((l, r) => l || r);
const arithmeticAnd = op2((l, r) => l & r);
const arithmeticOr = op2((l, r) => l | r);
const arithmeticXor = op2((l, r) => l | r);

const uplus = op1(r => +r);
const uminus = op1(r => -r);
const unot = op1(r => !r);
const ucomplement = op1(r => ~r);

export const binarySymbolToName = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divide',
  '%': 'mod',
  '**': 'pow',
  '==': 'eq',
  '!=': 'ne',
  '>=': 'ge',
  '>': 'gt',
  '<=': 'le',
  '<': 'lt',
  '<<': 'lshift',
  '>>': 'rshift',
  '&&': 'logicalAnd',
  '||': 'logicalOr',
  '&': 'arithmeticAnd',
  '|': 'arithmeticOr',
  '^': 'arithmeticXor',
};

export const unarySymbolToName = {
  '+': 'uplus',
  '-': 'uminus',
  '!': 'unot',
  '~': 'ucomplement',
};

// Our unary operators are all higher precedence than our binary ones,
// so we can just use the operator symbols here.
export const binaryPrecedences = {
  '+': 13,
  '-': 13,
  '*': 14,
  '/': 14,
  '%': 14,
  '**': 15,
  '==': 10,
  '!=': 10,
  '>=': 11,
  '>': 11,
  '<=': 11,
  '<': 11,
  '<<': 12,
  '>>': 12,
  '&&': 6,
  '||': 5,
  '&': 9,
  '|': 7,
  '^': 8,
};

export const assocRight = new Set(['**']);

export default {
  plus,
  minus,
  times,
  divide,
  mod,
  pow,
  eq,
  ne,
  ge,
  gt,
  le,
  lt,
  lshift,
  rshift,
  logicalAnd,
  logicalOr,
  arithmeticAnd,
  arithmeticOr,
  arithmeticXor,
  uplus,
  uminus,
  unot,
  ucomplement,
};
