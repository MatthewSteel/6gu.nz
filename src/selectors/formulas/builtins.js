import { TableArray } from './tables';
// Built-in functions and operators
const NUMBER_T = 0;
const STRING_T = 1;
const BOOL_T = 2;
const NULL_T = 3;
export const ARRAY_T = 4;
const OBJECT_T = 5;

export const classify = (o) => {
  const t = typeof o;
  if (t === 'object') {
    if (o.byName) return OBJECT_T;
    if (o.arr) return ARRAY_T;
    if (!o) return NULL_T;
    throw new Error('bad type');
  }
  return {
    boolean: BOOL_T,
    number: NUMBER_T,
    string: STRING_T,
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
    if (type1 === ARRAY_T && type2 === ARRAY_T) {
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
    if (type1 === ARRAY_T) {
      return new TableArray(left.arr.map((
        leftElem => tryF(leftElem, { value: right }))));
    }
    if (type2 === ARRAY_T) {
      return new TableArray(right.arr.map((
        rightElem => tryF({ value: left }, rightElem))));
    }
    if (type1 === OBJECT_T || type2 === OBJECT_T) {
      throw new Error('Operator not supported for objects');
    }
    return op(left, right);
  };
  return f;
};

export const deepOp1 = (op) => {
  const f = (right) => {
    const type1 = classify(right);
    if (type1 === OBJECT_T) {
      throw new Error('Operator not supported for objects');
    }
    if (type1 === ARRAY_T) {
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

const log = (args, kwargs) => {
  let base = Math.E;
  const deepLog = deepOp1(Math.log);
  for (const [key, value] of Object.entries(kwargs)) {
    if (key !== 'base') {
      throw new Error('log only takes "base" as a keyword argument');
    }
    base = value;
  }
  if (args.length === 0) return -Infinity;
  if (args.length === 1) {
    if (base === Math.E) return deepLog(args[0]);
    return divide(deepLog(args[0]), deepLog(base));
  }
  return new TableArray(args.map((elem) => {
    if (elem.error) return elem;
    if (base === Math.E) return { value: deepLog(elem.value) };
    return {
      value: divide(deepLog(elem.value), deepLog(base)),
    };
  }));
};

const flatten = (args, kwargs) => {
  let depth = Infinity;
  for (const [key, value] of Object.entries(kwargs)) {
    if (key !== 'depth') {
      throw new Error('log only takes "depth" as a keyword argument');
    }
    depth = value;
  }
  if (args.length === 0) return new TableArray([]);
  if (args.length === 1) {
    return flatten1(args[0], depth);
  }
  return new TableArray(args.map((elem) => {
    if (elem.error) return elem.error;
    try {
      return { value: flatten1(elem.valu) };
    } catch (e) {
      return { error: e.toString() };
    }
  }));
};

const flatten1 = (thing, depth) => {
  if (depth <= 0) return thing;
  const ret = [];
  if (classify(thing) !== ARRAY_T) return thing;

  thing.arr.forEach((elem) => {
    if (elem.error) {
      ret.push(elem);
    } else {
      const flattenedElem = flatten1(elem.value, depth - 1);
      if (classify(flattenedElem) === ARRAY_T) {
        flattenedElem.arr.forEach((subElem) => { ret.push(subElem); });
      } else {
        ret.push(elem);
      }
    }
  });
  return new TableArray(ret);
};

const unaryFn = (fn, name) => (args, kwargs) => {
  if (Object.keys(kwargs).length > 0) {
    throw new Error(`${name} does not take keyword parameters.`);
  }
  if (!args.length) return fn(0);
  if (args.length === 1) return fn(args[0]);
  return new TableArray(args.map((elem) => {
    if (elem.error) return elem;
    try {
      return { value: fn(elem.value) };
    } catch (e) {
      return { error: e.toString() };
    }
  }));
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
    case ARRAY_T: return thing.arr.length;
    case OBJECT_T: return Object.keys(thing.byName).length;
    case STRING_T: return thing.length;
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
    case NUMBER_T: return thing;
    case BOOL_T: return thing;
    case NULL_T: return 0;
    case STRING_T: throw new Error('Sum not supported for strings');
    case OBJECT_T: throw new Error('Sum not supported for objects yet');
    case ARRAY_T: return thing.arr.reduce(
      (l, r) => {
        if (r.error) throw new Error(r.error);
        return l + sum1(r.value);
      },
      0,
    );
    default: throw new Error('Do not know how to sum this thing.');
  }
};

const transpose1 = (thing) => {
  if (classify(thing) !== ARRAY_T) {
    throw new Error('Can only transpose arrays');
  }
  if (thing.arr.length === 0) return new TableArray([]); // ?

  let retArr;
  thing.arr.forEach((elem) => {
    if (elem.error) {
      throw new Error('Cannot transpose an array containing errors');
    }
    if (retArr === undefined) {
      const elemLength = size1(elem.value);
      retArr = new Array(elemLength);
      for (let i = 0; i < elemLength; ++i) {
        retArr[i] = { value: new TableArray([]) };
      }
    } else if (size1(elem.value) !== retArr.length) {
      throw new Error('Can only transpose "rectangular" things');
    }
    const { value } = elem;
    if (typeof value === 'string') {
      for (let i = 0; i < value.length; ++i) {
        retArr[i].value.arr.push({ value: value[i] });
      }
    } else if (value.arr) {
      value.arr.forEach((valueOrError, index) => {
        retArr[index].value.arr.push(valueOrError);
      });
    } else {
      throw new Error('Can only transpose arrays containing arrays or strings');
    }
  });
  return new TableArray(retArr);
};

const count1 = (thing) => {
  const type = classify(thing);
  switch (type) {
    case NUMBER_T: return 1;
    case BOOL_T: return 1;
    case NULL_T: return 0;
    case STRING_T: return 1;
    case OBJECT_T: return 1; // !!!
    case ARRAY_T: return thing.arr.reduce(
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
    case NUMBER_T:
    case STRING_T:
    case BOOL_T:
      return (left > right) - (right > left);
    case ARRAY_T:
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
const e = () => Math.E;
const sqrt = unaryFn(deepOp1(Math.sqrt), 'sqrt');
const abs = unaryFn(deepOp1(Math.abs), 'abs');
const round = unaryFn(deepOp1(Math.round), 'round');
const length = unaryFn(deepOp1(stringLen), 'length');
const size = unaryFn(size1, 'size');
const range = unaryFn(range1, 'range');
const sum = deepAggregate(sum1, 'sum');
const count = deepAggregate(count1, 'count');
const transpose = unaryFn(transpose1, 'transpose');

const average = (args, kwargs) => {
  const s = sum(args, kwargs);
  const c = count(args, kwargs);
  return divide(s, c);
};

export const globalFunctions = {
  sum,
  count,
  transpose,
  flatten,
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
  e,
  log,
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
  transpose: new Set(),
  flatten: new Set(['depth']),
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
  log: new Set(['base']),
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
