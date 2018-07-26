import { generatorLex, lexFormula } from './lexer';

describe('lexFormula', () => {
  it('lexes a simple assignment', () => {
    expect(lexFormula('foo:bar')).toEqual([
      { name: 'foo', inputLength: 3 },
      { assignment: ':', inputLength: 1 },
      { name: 'bar', inputLength: 3 },
    ]);
  });

  it('works with spaces', () => {
    expect(lexFormula(' "hello"  + " world!" * 12.0')).toEqual([
      { value: 'hello', inputLength: 7 },
      { op: '+', inputLength: 1 },
      { value: ' world!', inputLength: 9 },
      { op: '*', inputLength: 1 },
      { value: 12, inputLength: 4 },
    ]);
  });

  it('gives us what we expect for lookups and calls', () => {
    expect(lexFormula(' :func( sheet.cell:0).value')).toEqual([
      { assignment: ':', inputLength: 1 },
      { name: 'func', inputLength: 4 },
      { open: '(', inputLength: 1 },
      { name: 'sheet', inputLength: 5 },
      { lookup: '.', inputLength: 1 },
      { name: 'cell', inputLength: 4 },
      { assignment: ':', inputLength: 1 },
      { value: 0, inputLength: 1 },
      { close: ')', inputLength: 1 },
      { lookup: '.', inputLength: 1 },
      { name: 'value', inputLength: 5 },
    ]);
  });

  it('handles literal bools', () => {
    expect(lexFormula('true||false')).toEqual([
      { value: true, inputLength: 4 },
      { op: '||', inputLength: 2 },
      { value: false, inputLength: 5 },
    ]);
  });

  it('interprets a leading apostrophe as "literal string follows"', () => {
    expect(lexFormula("'tr:evor=\\n")).toEqual([{ value: 'tr:evor=\\n' }]);
  });

  it('deals with escaped things in names and strings', () => {
    expect(lexFormula('\\ hi')).toEqual([{
      name: ' hi', inputLength: 4,
    }]);
    expect(lexFormula('hi\\ there')).toEqual([{
      name: 'hi there', inputLength: 9,
    }]);
    expect(lexFormula('"hi\\nthere"')).toEqual([{
      value: 'hi\nthere', inputLength: 11,
    }]);
    expect(lexFormula('"\\\\"')).toEqual([{ value: '\\', inputLength: 4 }]);
  });

  it('lexes all the numbers we are interested in', () => {
    expect(lexFormula('0.5')).toEqual([{ value: 0.5, inputLength: 3 }]);
    expect(lexFormula('1')).toEqual([{ value: 1, inputLength: 1 }]);

    // :-(
    expect(lexFormula('.5')).toEqual([
      { lookup: '.', inputLength: 1 }, { value: 5, inputLength: 1 },
    ]);
    expect(() => lexFormula('0.')).toThrow(SyntaxError);
  });

  it('lexes incrementally how we would expect', () => {
    const stream = [
      { input: null, output: [] },
      { input: 'x', output: [] },
      {
        input: '+',
        output: [{ name: 'x', inputLength: 1 }, { op: '+', inputLength: 1 }],
      },
      { input: 'x', output: [] },
      { input: 'y', output: [] },
      { input: 'z', output: [] },
      { input: '>', output: [{ name: 'xyz', inputLength: 3 }] },
      { input: '=', output: [{ op: '>=', inputLength: 2 }] },
      { input: '(', output: [{ open: '(', inputLength: 1 }] },
      { input: '1', output: [] },
      {
        input: ')',
        output: [{ value: 1, inputLength: 1 }, { close: ')', inputLength: 1 }],
      },
      { input: '<', output: [] },
      { input: '6', output: [{ op: '<', inputLength: 1 }] },
      { input: ' ', output: [{ value: 6, inputLength: 1 }] },
      { input: '"', output: [{ whitespace: ' ', inputLength: 1 }] },
      { input: 'a', output: [] },
      { input: '"', output: [{ value: 'a', inputLength: 3 }] },
      { input: null, output: [] },
    ];
    const gen = generatorLex();
    stream.forEach(({ input, output }) => {
      expect(gen.next(input).value).toEqual(output);
    });
  });

  it('"gracefully" lexes unterminated strings', () => {
    const stream = [
      { input: null, output: [] },
      { input: '"', output: [] },
      { input: 'a', output: [] },
      { input: null, output: [{ value: 'a', inputLength: 2 }] },
    ];
    const gen = generatorLex();
    stream.forEach(({ input, output }) => {
      expect(gen.next(input).value).toEqual(output);
    });
  });
});
