// Built-in functions and operators
const plus = (l, r) => l + r;
const minus = (l, r) => l - r;
const times = (l, r) => l * r;
const divide = (l, r) => l / r;
const mod = (l, r) => l % r;
const pow = (l, r) => l ** r;
const eq = (l, r) => l === r;
const ge = (l, r) => l >= r;
const gt = (l, r) => l > r;
const le = (l, r) => l <= r;
const lt = (l, r) => l < r;
const logicalAnd = (l, r) => l && r;
const logicalOr = (l, r) => l || r;
const arithmeticAnd = (l, r) => l & r;
const arithmeticOr = (l, r) => l | r;
const arithmeticXor = (l, r) => l | r;

const uplus = r => +r;
const uminus = r => -r;
const unot = r => !r;
const ucomplement = r => ~r;

export const binarySymbolToName = {
  '+': 'plus',
  '-': 'minus',
  '*': 'times',
  '/': 'divide',
  '%': 'mod',
  '**': 'pow',
  '==': 'eq',
  '>=': 'ge',
  '>': 'gt',
  '<=': 'le',
  '<': 'lt',
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

export default {
  plus,
  minus,
  times,
  divide,
  mod,
  pow,
  eq,
  ge,
  gt,
  le,
  lt,
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
