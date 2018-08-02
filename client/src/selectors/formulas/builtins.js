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
    if (!o) return NULL_T;
    if (o.byName) return OBJECT_T;
    if (o.arr) return ARRAY_T;
    throw new Error('bad type');
  }
  return {
    boolean: BOOL_T,
    number: NUMBER_T,
    string: STRING_T,
  }[t];
};

export const deepOp = (op) => {
  const f = (elems) => {
    const types = [];
    let someArrays = false;
    let arrayLengths;
    for (let i = 0; i < elems.length; ++i) {
      const elem = elems[i];
      const type = classify(elem);
      if (type === OBJECT_T) {
        throw new Error('Operator not supported for objects');
      }
      if (type === ARRAY_T) {
        const { length } = elem.arr;
        if (someArrays && length !== arrayLengths) {
          throw new Error('Mismatched array lengths');
        }
        someArrays = true;
        arrayLengths = length;
      }
      types.push(type);
    }
    if (!someArrays) return op(...elems);

    const ret = [];
    for (let i = 0; i < arrayLengths; ++i) {
      const args = [];
      let someError;
      for (let j = 0; j < elems.length; ++j) {
        if (types[j] === ARRAY_T) {
          const elem = elems[j].arr[i];
          if (elem.error) someError = elem;
          else args.push(elems[j].arr[i].value);
        } else {
          args.push(elems[j]);
        }
      }
      ret.push(someError || { value: f(args) });
    }
    return new TableArray(ret);
  };
  return f;
};

const deepOpFixed = (fn) => {
  const generatedFn = deepOp(fn);
  return (...args) => generatedFn(args);
};

const plus = deepOpFixed((l, r) => l + r);
const minus = deepOpFixed((l, r) => l - r);
const times = deepOpFixed((l, r) => l * r);
const divide = deepOpFixed((l, r) => l / r);
const mod = deepOpFixed((l, r) => l % r);
const pow = deepOpFixed((l, r) => l ** r);
const eq = deepOpFixed((l, r) => l === r);
const ne = deepOpFixed((l, r) => l !== r);
const ge = deepOpFixed((l, r) => l >= r);
const gt = deepOpFixed((l, r) => l > r);
const le = deepOpFixed((l, r) => l <= r);
const lt = deepOpFixed((l, r) => l < r);
const lshift = deepOpFixed((l, r) => l << r);
const rshift = deepOpFixed((l, r) => l >> r);
const logicalAnd = deepOpFixed((l, r) => l && r);
const logicalOr = deepOpFixed((l, r) => l || r);
const arithmeticAnd = deepOpFixed((l, r) => l & r);
const arithmeticOr = deepOpFixed((l, r) => l | r);
const arithmeticXor = deepOpFixed((l, r) => l | r);

const uplus = deepOpFixed(r => +r);
const uminus = deepOpFixed(r => -r);
const unot = deepOpFixed(r => !r);
const ucomplement = deepOpFixed(r => ~r);

const boundOp = deepOp((lb, x, ub) => {
  if (x < lb) return lb;
  if (x > ub) return ub;
  return x;
});

const ifOpClosure = deepOp((cond, t, f) => (cond ? t : f));
const ifOp = (args, kwargs) => {
  if (args.length !== 3) {
    throw new Error('"if" takes 3 arguments');
  }
  if (kwargs.length) {
    throw new Error('"if" takes no keyword arguments');
  }
  return ifOpClosure(args);
};

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
    if (args.length === 1) return deepOp(fn)([args[0]]);
    return new TableArray(args.map(elem => ({
      value: deepOp(fn)([elem]),
    })));
  }
  if (Object.keys(kwargs).length === 0) return fn(0);
  if (kwargs.radians) {
    return deepOp(fn)([kwargs.radians]);
  }
  if (kwargs.degrees) {
    return deepOp(fn)([times(Math.PI / 180, kwargs.degrees)]);
  }
  throw new Error(`Unexpected argument to ${name}: ${Object.keys(kwargs)[0]}`);
};

const log = (args, kwargs) => {
  let base = Math.E;
  const deepLog = deepOpFixed(Math.log);
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

const bound = (args, kwargs) => {
  if (args.length !== 1) {
    throw new Error('Bound takes exactly one position argument');
  }
  let lower = args[0];
  let upper = args[0];
  for (const [key, value] of Object.entries(kwargs)) {
    if (key === 'lower') {
      lower = value;
    } else if (key === 'upper') {
      upper = value;
    } else {
      throw new Error('bound only takes "lower" or "upper" as a keyword arguments');
    }
  }
  return boundOp([lower, args[0], upper]);
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
  for (let i = 0; i < by.arr.length; ++i) {
    const elem = by.arr[i];
    if (elem.error) continue;
    const type = classify(elem.value);
    if (type === ARRAY_T) {
      throw new Error('"by:" arguments cannot be arrays.');
    }
    if (type === OBJECT_T) {
      throw new Error('"by:" arguments cannot be objects.');
    }
  }
  return fn(args[0], by);
};

const oneKwargFunction = (fn, name, kwargName, kwargDefault) => (args, kwargs) => {
  if (args.length !== 1) {
    throw new Error(`${name} takes one parameter (and maybe "${kwargName}:")`);
  }
  let kwarg = kwargDefault;
  for (const [key, value] of Object.entries(kwargs)) {
    if (key !== kwargName) {
      throw new Error(`${name} does not take a parameter ${key} (just "${kwargName}:")`);
    }
    kwarg = value;
  }
  return fn(args[0], kwarg);
};

const atan2 = oneKwargFunction(deepOpFixed((l, r, unit) => {
  const angle = Math.atan2(l, r);
  if (unit === 'degrees') return angle * 180 / Math.PI;
  if (unit === 'radians') return angle;
  throw new Error('"in:" must be "degrees" or "radians"');
}), 'atan2', 'in', 'radians');
const asin = oneKwargFunction(deepOpFixed((l, unit) => {
  const angle = Math.asin(l);
  if (unit === 'degrees') return angle * 180 / Math.PI;
  if (unit === 'radians') return angle;
  throw new Error('"in:" must be "degrees" or "radians"');
}), 'asin', 'in', 'radians');
const acos = oneKwargFunction(deepOpFixed((l, unit) => {
  const angle = Math.acos(l);
  if (unit === 'degrees') return angle * 180 / Math.PI;
  if (unit === 'radians') return angle;
  throw new Error('"in:" must be "degrees" or "radians"');
}), 'acos', 'in', 'radians');

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

const groupFn = (arr, by) => {
  by.arr.forEach((elem) => { if (elem.error) throw new Error(elem.error); });
  const hashes = {};
  for (let i = 0; i < by.arr.length; ++i) {
    const byValue = by.arr[i].value;
    if (!hashes[byValue]) hashes[byValue] = [arr.arr[i]];
    else hashes[byValue].push(arr.arr[i]);
  }
  const ret = Object.entries(hashes).map(([byValue, items]) => ({
    value: {
      byName: {
        by: { value: byValue },
        group: { value: new TableArray(items) },
      },
    },
  }));
  return new TableArray(ret);
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

const toRaw1 = (thing) => {
  const objRet = {};
  switch (classify(thing)) {
    case ARRAY_T:
      return thing.arr.map((elem) => {
        if (elem.error) throw new Error(elem.error);
        return toRaw1(elem.value);
      });
    case OBJECT_T:
      for (const [k, v] of Object.entries(thing.byName)) {
        if (v.error) throw new Error(v.error);
        objRet[k] = toRaw1(v.value);
      }
      return objRet;
    default:
      return thing;
  }
};
export const toJson1 = thing => JSON.stringify(toRaw1(thing));

const fromRaw1 = (thing) => {
  if (thing instanceof Array) {
    return new TableArray(thing.map(elem => ({ value: fromRaw1(elem) })));
  }
  if (thing instanceof Object) {
    const byName = {};
    for (const [k, v] of Object.entries(thing)) {
      byName[k] = { value: fromRaw1(v) };
    }
    return { byName };
  }
  return thing;
};
export const fromJson1 = thing => fromRaw1(JSON.parse(thing));


const sin = trig(Math.sin, 'sin');
const cos = trig(Math.cos, 'sin');
const tan = trig(Math.tan, 'sin');
const pi = () => Math.PI;
const e = () => Math.E;
const sqrt = unaryFn(deepOpFixed(Math.sqrt), 'sqrt');
const abs = unaryFn(deepOpFixed(Math.abs), 'abs');
const round = unaryFn(deepOpFixed(Math.round), 'round');
const length = unaryFn(deepOpFixed(stringLen), 'length');
const size = unaryFn(size1, 'size');
const range = unaryFn(range1, 'range');
const sum = deepAggregate(sum1, 'sum');
const count = deepAggregate(count1, 'count');
const transpose = unaryFn(transpose1, 'transpose');
const toJson = unaryFn(toJson1, 'toJson');
const fromJson = unaryFn(fromJson1, 'fromJson');

const average = (args, kwargs) => {
  const s = sum(args, kwargs);
  const c = count(args, kwargs);
  return divide(s, c);
};

export const globalFunctions = {
  if: ifOp,
  sum,
  count,
  transpose,
  flatten,
  bound,
  average,
  filter: byFunction(filterFn, 'filter'),
  sort: byFunction(sortFn, 'sort'),
  group: byFunction(groupFn, 'group'),
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
  toJson,
  fromJson,
};

export const globalFunctionArgs = {
  if: new Set(),
  sum: new Set(),
  count: new Set(),
  transpose: new Set(),
  flatten: new Set(['depth']),
  average: new Set(),
  bound: new Set(['lower', 'upper']),
  filter: new Set(['by']),
  sort: new Set(['by']),
  group: new Set(['by']),
  sin: new Set(['degrees', 'radians']),
  cos: new Set(['degrees', 'radians']),
  tan: new Set(['degrees', 'radians']),
  asin: new Set(['in']),
  acos: new Set(['in']),
  atan2: new Set(['in']),
  pi: new Set(),
  sqrt: new Set(),
  abs: new Set(),
  round: new Set(),
  size: new Set(),
  length: new Set(),
  range: new Set(),
  log: new Set(['base']),
  toJson: new Set(),
  fromJson: new Set(),
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
