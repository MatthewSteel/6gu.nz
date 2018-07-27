import React from 'react';
import classNames from 'classnames';
import { renderToStaticMarkup } from 'react-dom/server';
import { unlexToken, unparseFormula } from './unparser';
import { getCellValuesById } from './codegen';
import SheetCellComponent from '../../components/CellComponent/SheetCellComponent';

export const zeroWidthSpace = '\u200A';
export const zwsRegex = /\u200A/g;
export const nbsp = '\u00A0';

export const inputFromFormula = (ref, state) => {
  // Translate refs into lookups etc for now. Later on we can set it to
  // false.
  const tokens = unparseFormula(ref, state, false);
  const ret = [];
  let currentString = [];
  const addStrings = () => {
    if (currentString.length) {
      ret.push(currentString.join(''));
      currentString = [];
    }
  };
  tokens.forEach((token) => {
    if (tokenRenderable(token)) {
      addStrings();
      ret.push(token);
    } else {
      currentString.push(unlexToken(state)(token));
    }
  });
  addStrings();
  return ret;
};

export const inputFromDom = (node) => {
  const ret = [];
  let currentString = [];
  const addStrings = () => {
    if (currentString.length) {
      ret.push(currentString.join('').replace(nbsp, ' '));
      currentString = [];
    }
  };
  for (let i = 0; i < node.childNodes.length; ++i) {
    const child = node.childNodes.item(i);
    if (child.nodeType === 3) {
      currentString.push(child.data.replace(zwsRegex, ''));
    } else if (child.attributes && child.attributes['data-6gu-src']) {
      addStrings();
      ret.push(JSON.parse(child.attributes['data-6gu-src'].value));
    }
  }
  addStrings();
  return ret;
};

const rawOps = new Set(['>', '<', '=', '+']);

const tokenRenderable = token => !('value' in token)
  && !token.whitespace
  && !rawOps.has(token.op);

const opStrings = {
  '<<': '\u226A',
  '>>': '\u226B',
  '<=': '\u2264',
  '>=': '\u2265',
  '!=': '\u2260',
  '-': '\u2212',
  '*': '\u00D7',
  '/': '\u2044',
};

const renderCell = (name, value, isName) => (
  <div className={classNames('CellTermSurround', isName && 'NameToken')}>
    <SheetCellComponent
      x={0}
      y={0}
      width={1}
      height={1}
      name={name}
      value={value}
    />
  </div>
);

const renderToken = (state, token, blankOutRefValue) => {
  if (token.name || token.ref) {
    const name = unlexToken(state)(token);
    const value = (token.name || blankOutRefValue)
      ? { value: nbsp } : getCellValuesById(state)[token.ref];
    return renderCell(name, value, token.name && !blankOutRefValue);
  }

  const { inputLength, ...restOfToken } = token;
  const key = Object.keys(restOfToken)[0];
  let value = Object.values(restOfToken)[0];

  const big = key.startsWith('open')
    || key.startsWith('close');
  if (opStrings[token.op]) value = opStrings[token.op];
  if (token.lookup) value = '\u2022'; // bullet
  return <div className={big ? 'BigToken' : 'SmallToken'}>{value}</div>;
};

export const htmlFromInput = (input, state) => {
  const ret = [];
  input.forEach((elem, i) => {
    if (typeof elem === 'string') {
      ret.push(elem.replace(' ', nbsp));
    } else {
      const nextToken = input[i + 1];
      const blankOutRefValue = nextToken
        && (nextToken.open || nextToken.assignment);
      ret.push([
        zeroWidthSpace,
        (
          <div
            data-6gu-src={JSON.stringify(elem)}
            contentEditable={false}
            style={{ display: 'inline-block' }}
            key={i}
          >
            {renderToken(state, elem, blankOutRefValue)}
          </div>
        ),
        zeroWidthSpace,
      ]);
    }
  });
  return renderToStaticMarkup(ret);
};

export const formulaFromInput = (input, state) => input.map((elem) => {
  if (typeof elem === 'string') return elem;
  return unlexToken(state)(elem);
}).join('');
