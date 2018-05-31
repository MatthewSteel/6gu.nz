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
    throw new Error('bad type');
  }
  return {
    boolean: BOOL,
    number: NUMBER,
    string: STRING,
  }[t];
};

export const deepOp2 = (op) => {
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

export const deepOp1 = (op) => {
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

const plus = deepOp2((l, r) => l + r);
const minus = deepOp2((l, r) => l - r);
const times = deepOp2((l, r) => l * r);
const divide = deepOp2((l, r) => l / r);
const mod = deepOp2((l, r) => l % r);
const pow = deepOp2((l, r) => l ** r);
const eq = deepOp2((l, r) => l === r);
const ne = deepOp2((l, r) => l !== r);
const ge = deepOp2((l, r) => l >= r);
const gt = deepOp2((l, r) => l > r);
const le = deepOp2((l, r) => l <= r);
const lt = deepOp2((l, r) => l < r);
const lshift = deepOp2((l, r) => l << r);
const rshift = deepOp2((l, r) => l >> r);
const logicalAnd = deepOp2((l, r) => l && r);
const logicalOr = deepOp2((l, r) => l || r);
const arithmeticAnd = deepOp2((l, r) => l & r);
const arithmeticOr = deepOp2((l, r) => l | r);
const arithmeticXor = deepOp2((l, r) => l | r);
const atan2 = deepOp2(Math.atan2);

const uplus = deepOp1(r => +r);
const uminus = deepOp1(r => -r);
const unot = deepOp1(r => !r);
const ucomplement = deepOp1(r => ~r);
const asin = deepOp1(Math.asin);
const acos = deepOp1(Math.acos);

export const binarySymbolToName = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divide',
  '%': 'mod',
  '**': 'pow',
  '=': 'eq',
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

const trig = (fn, name) => (args, kwargs) => {
  if ((args.length !== 0) + Object.keys(kwargs).length > 1) {
    throw new Error(`If ${name} takes a keyword parameter is must take only that parameter.`);
  }
  if (args.length) {
    if (args.length === 1) return deepOp1(fn)(args[0]);
    return new TableArray(args.map(elem => ({ value: deepOp1(fn)(elem) })));
  }
  if (Object.keys(kwargs).length === 0) return fn(0);
  if (kwargs.radians) {
    return deepOp1(fn)(kwargs.radians);
  }
  if (kwargs.degrees) {
    return deepOp1(fn)(times(Math.PI / 180, kwargs.degrees));
  }
  throw new Error(`Unexpected argument to ${name}: ${Object.keys(kwargs)[0]}`);
};

const unaryFn = (fn, name) => (args, kwargs) => {
  if (Object.keys(kwargs).length > 0) {
    throw new Error(`${name} does not take keyword parameters.`);
  }
  if (!args.length) return fn(0);
  if (args.length === 1) return fn(args[0]);
  return new TableArray(args.map(elem => ({ value: fn(elem) })));
};

const range1 = (thing) => {
  if (typeof thing !== 'number') {
    throw new Error('Range needs to be called with whole numbers');
  }
  const roundedNum = Math.round(thing);
  if (Math.abs(roundedNum - thing) > 0.01) {
    throw new Error('Range needs to be called with whole numbers');
  }
  const direction = roundedNum > 0 ? 1 : -1;
  const ret = [];
  for (let i = 0; i !== roundedNum; i += direction) {
    ret.push({ value: i });
  }
  return new TableArray(ret);
};

const size1 = (thing) => {
  const type = classify(thing);
  switch (type) {
    case ARRAY: return thing.arr.length;
    case OBJECT: return Object.keys(thing.byName).length;
    case STRING: return thing.length;
    default: throw new Error('Has no length.');
  }
};

const deepAggregate = (fn, name) => (args, kwargs) => {
  if (Object.keys(kwargs).length > 0) {
    throw new Error(`${name} does not take keyword parameters.`);
  }
  return args.reduce((l, r) => l + fn(r), 0);
};

const byFunction = (fn, name) => (args, kwargs) => {
  if (args.length !== 1) {
    throw new Error(`${name} takes one array parameter (and maybe "by:")`);
  }
  let by = args[0];
  for (const [key, value] of Object.entries(kwargs)) {
    if (key !== 'by') {
      throw new Error(`${name} does not take a parameter ${key} (just "by:")`);
    }
    by = value;
  }
  if (!(args[0] instanceof TableArray)) {
    throw new Error(`The first parameter to ${name} must be an array.`);
  }
  if (!(by instanceof TableArray)) {
    throw new Error(`"by" parameter to ${name} must be an array.`);
  }
  if (by.arr.length !== args[0].arr.length) {
    throw new Error(`"by" parameter to ${name} must have the right length.`);
  }
  return fn(args[0], by);
};

const filterFn = (arr, by) => {
  const retArr = [];
  arr.arr.forEach((element, i) => {
    const byElem = by.arr[i];
    if (!byElem) return;
    if (byElem.error) retArr.push(byElem.error);
    if (byElem.value) retArr.push(element);
  });
  return new TableArray(retArr);
};

const sortFn = (arr, by) => {
  arr.arr.forEach((elem) => { if (elem.error) throw new Error(elem.error); });
  by.arr.forEach((elem) => { if (elem.error) throw new Error(elem.error); });

  const retIndices = [];
  for (let i = 0; i < by.arr.length; ++i) retIndices.push(i);
  retIndices.sort((leftIndex, rightIndex) => (
    cmp(by.arr[leftIndex].value, by.arr[rightIndex].value)));
  return new TableArray(retIndices.map(index => arr.arr[index]));
};

const sum1 = (thing) => {
  const type = classify(thing);
  switch (type) {
    case NUMBER: return thing;
    case BOOL: return thing;
    case NULL: return 0;
    case STRING: throw new Error('Sum not supported for strings');
    case OBJECT: throw new Error('Sum not supported for objects yet');
    case ARRAY: return thing.arr.reduce(
      (l, r) => {
        if (r.error) throw new Error(r.error);
        return l + sum1(r.value);
      },
      0,
    );
    default: throw new Error('Do not know how to sum this thing.');
  }
};

const count1 = (thing) => {
  const type = classify(thing);
  switch (type) {
    case NUMBER: return 1;
    case BOOL: return 1;
    case NULL: return 0;
    case STRING: return 1;
    case OBJECT: return 1; // !!!
    case ARRAY: return thing.arr.reduce(
      (l, r) => {
        if (r.error) throw new Error(r.error);
        return l + count1(r.value);
      },
      0,
    );
    default: throw new Error('Do not know how to sum this thing.');
  }
};

const cmp = (left, right) => {
  const leftType = classify(left);
  const rightType = classify(right);
  if (leftType !== rightType) {
    throw new Error('Cannot compare items of different type');
  }
  switch (leftType) {
    case NUMBER:
    case STRING:
    case BOOL:
      return (left > right) - (right > left);
    case ARRAY:
      for (let i = 0; i < left.arr.length && i < right.arr.length; i += 1) {
        const c = cmp(left.arr[i], right.arr[i]);
        if (c !== 0) return c;
      }
      return cmp(left.arr.length, right.arr.length);
    default:
      throw new Error('Do not know how to compare these items.');
  }
};

const stringLen = (thing) => {
  if (typeof thing !== 'string') {
    throw new Error('Can only get lengths of strings');
  }
  return thing.length;
};


const sin = trig(Math.sin, 'sin');
const cos = trig(Math.cos, 'sin');
const tan = trig(Math.tan, 'sin');
const pi = () => Math.PI;
const sqrt = unaryFn(deepOp1(Math.sqrt), 'sqrt');
const abs = unaryFn(deepOp1(Math.abs), 'abs');
const round = unaryFn(deepOp1(Math.round), 'round');
const length = unaryFn(deepOp1(stringLen), 'length');
const size = unaryFn(size1, 'size');
const range = unaryFn(range1, 'range');
const sum = deepAggregate(sum1, 'sum');
const count = deepAggregate(count1, 'count');

const average = (args, kwargs) => {
  const s = sum(args, kwargs);
  const c = count(args, kwargs);
  return divide(s, c);
};

export const globalFunctions = {
  sum,
  count,
  average,
  filter: byFunction(filterFn, 'filter'),
  sort: byFunction(sortFn, 'sort'),
  sin,
  cos,
  tan,
  atan2,
  asin,
  acos,
  pi,
  sqrt,
  abs,
  round,
  size,
  length,
  range,
};

export const globalFunctionArgs = {
  sum: new Set(),
  count: new Set(),
  average: new Set(),
  filter: new Set(['by']),
  sort: new Set(['by']),
  sin: new Set(['degrees', 'radians']),
  cos: new Set(['degrees', 'radians']),
  tan: new Set(['degrees', 'radians']),
  asin: new Set(),
  acos: new Set(),
  atan2: new Set(),
  pi: new Set(),
  sqrt: new Set(),
  abs: new Set(),
  round: new Set(),
  size: new Set(),
  length: new Set(),
  range: new Set(),
};

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
