import { lexFormula, bareToken } from './lexer';
import { getSheets } from './selectors';
import store from '../../redux/store';
import { parseFormula, parseTokens } from './parser';
import { LOGIN_STATES } from '../../redux/stateConstants';
import { blankDocument } from '../../redux/backend';

const parse = (formula, contextId) => (
  parseFormula(formula, contextId, store.getState()));

describe('parser', () => {
  beforeEach(() => {
    store.dispatch({
      type: 'USER_STATE',
      payload: {
        userState: { loginState: LOGIN_STATES.LOGGED_IN, documents: [] },
        openDocument: blankDocument(),
      },
    });
  });

  it('parses a complicated call', () => {
    const formula = 'a.b(foo:bar.baz.arf[10], quux:1+"hi").fi\\ eld';
    const tokens = [
      { name: 'a' },
      { lookup: '.' },
      { name: 'b' },
      { open: '(' },
      { name: 'foo' },
      { assignment: ':' },
      { name: 'bar' },
      { lookup: '.' },
      { name: 'baz' },
      { lookup: '.' },
      { name: 'arf' },
      { openBracket: '[' },
      { value: 10 },
      { closeBracket: ']' },
      { comma: ',' },
      { name: 'quux' },
      { assignment: ':' },
      { value: 1 },
      { op: '+' },
      { value: 'hi' },
      { close: ')' },
      { lookup: '.' },
      { name: 'fi eld' },
    ];
    const expectedOutput = {
      lookup: 'fi eld',
      lookupType: '.',
      on: {
        call: { lookup: 'b', lookupType: '.', on: { name: 'a' } },
        args: [],
        kwargs: [{
          ref: { name: 'foo' },
          expr: {
            lookupIndex: { value: 10 },
            on: {
              lookup: 'arf',
              lookupType: '.',
              on: {
                lookup: 'baz',
                lookupType: '.',
                on: { name: 'bar' },
              },
            },
          },
        }, {
          ref: { name: 'quux' },
          expr: { binary: '+', left: { value: 1 }, right: { value: 'hi' } },
        }],
      },
    };

    // Just in case:
    expect(lexFormula(formula).map(bareToken)).toEqual(tokens);
    expect(parseTokens(tokens, 0)).toEqual(expectedOutput);
  });

  it('parses strings appropriately', () => {
    const s1 = getSheets(store.getState())[0];
    expect(parse(':')).toEqual({});
    expect(parse('foo :')).toEqual({ name: 'foo' });
    expect(parse('foo : bar', s1.id)).toEqual({
      name: 'foo',
      formula: { lookup: 'bar', lookupType: '.', on: { ref: s1.id } },
    });
    expect(parse('foo : bar +')).toEqual({
      name: 'foo',
      formula: { badFormula: 'bar +' },
    });
    expect(parse('foo =: bar +')).toEqual({
      formula: { badFormula: 'foo =: bar +' },
    });
  });

  it('parses unary operators', () => {
    const formula = '-!+~func(param:-arg)+- foo';
    const expectedOutput = {
      binary: '+',
      left: {
        unary: '-',
        on: {
          unary: '!',
          on: {
            unary: '+',
            on: {
              unary: '~',
              on: {
                call: { name: 'func' },
                args: [],
                kwargs: [{
                  ref: { name: 'param' },
                  expr: {
                    unary: '-',
                    on: { name: 'arg' },
                  },
                }],
              },
            },
          },
        },
      },
      right: {
        unary: '-',
        on: { name: 'foo' },
      },
    };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('gets operator precedence right', () => {
    const s1 = getSheets(store.getState())[0];

    const precedenceOutput = {
      binary: '+',
      left: { value: 1 },
      right: { binary: '*', left: { value: 2 }, right: { value: 3 } },
    };
    expect(parse('1+2*3', s1.id).formula).toEqual(precedenceOutput);

    const leftAssocOutput = {
      binary: '*',
      left: { binary: '/', left: { value: 2 }, right: { value: 2 } },
      right: { value: 2 },
    };
    expect(parse('2/2*2', s1.id).formula).toEqual(leftAssocOutput);

    const rightAssocOutput = {
      binary: '**',
      left: { value: 2 },
      right: { binary: '**', left: { value: 3 }, right: { value: 2 } },
    };
    expect(parse('2**3**2', s1.id).formula).toEqual(rightAssocOutput);

    //       *
    //      / \
    //     *   3
    //    / \
    //   **  2
    //  /  \
    // 12   1
    const recursionOutput = {
      binary: '*',
      left: {
        binary: '*',
        left: { binary: '**', left: { value: 12 }, right: { value: 1 } },
        right: { value: 2 },
      },
      right: { value: 3 },
    };
    expect(parse('12 ** 1 * 2*3', s1.id).formula).toEqual(recursionOutput);
  });

  it('parses an empty array', () => {
    const formula = '[]';
    const expectedOutput = { array: [] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an array of one element', () => {
    const formula = '["hi"]';
    const expectedOutput = { array: [{ value: 'hi' }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an array of two elements', () => {
    const formula = '["hi", 1]';
    const expectedOutput = { array: [{ value: 'hi' }, { value: 1 }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an array of two elements with a trailing comma', () => {
    const formula = '["hi", 1,]';
    const expectedOutput = { array: [{ value: 'hi' }, { value: 1 }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses nested arrays', () => {
    const formula = '[["hi"]]';
    const expectedOutput = {
      array: [{
        array: [{ value: 'hi' }],
      }],
    };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses an empty object', () => {
    const formula = '{}';
    const expectedOutput = { object: [] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });

  it('parses more complicated objects', () => {
    const formula = '{foo, bar: 10, baz.quux,}';
    const expectedOutput = { object: [{
      key: 'foo',
      value: { name: 'foo' },
    }, {
      key: 'bar',
      value: { value: 10 },
    }, {
      key: 'quux',
      value: { lookup: 'quux', lookupType: '.', on: { name: 'baz' } },
    }] };
    expect(parseTokens(lexFormula(formula), 0)).toEqual(expectedOutput);
  });
});
