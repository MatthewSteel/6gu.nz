import { generatorLex, lexFormula } from './lexer';

describe('lexFormula', () => {
  it('lexes a simple assignment', () => {
    expect(lexFormula('foo:bar')).toEqual([
      { name: 'foo' },
      { assignment: ':' },
      { name: 'bar' },
    ]);
  });

  it('works with spaces', () => {
    expect(lexFormula(' "hello"  + " world!" * 12.0')).toEqual([
      { value: 'hello' },
      { op: '+' },
      { value: ' world!' },
      { op: '*' },
      { value: 12.0 },
    ]);
  });

  it('gives us what we expect for lookups and calls', () => {
    expect(lexFormula(' :func( sheet.cell:0).value')).toEqual([
      { assignment: ':' },
      { name: 'func' },
      { open: '(' },
      { name: 'sheet' },
      { lookup: '.' },
      { name: 'cell' },
      { assignment: ':' },
      { value: 0 },
      { close: ')' },
      { lookup: '.' },
      { name: 'value' },
    ]);
  });

  it('handles literal bools', () => {
    expect(lexFormula('true||false')).toEqual([
      { value: true },
      { op: '||' },
      { value: false },
    ]);
  });

  it('interprets a leading apostrophe as "literal string follows"', () => {
    expect(lexFormula("'tr:evor=\\n")).toEqual([{ value: 'tr:evor=\\n' }]);
  });

  it('deals with escaped things in names and strings', () => {
    expect(lexFormula('\\ hi')).toEqual([{ name: ' hi' }]);
    expect(lexFormula('hi\\ there')).toEqual([{ name: 'hi there' }]);
    expect(lexFormula('"hi\\nthere"')).toEqual([{ value: 'hi\nthere' }]);
    expect(lexFormula('"\\\\"')).toEqual([{ value: '\\' }]);
  });

  it('lexes all the numbers we are interested in', () => {
    expect(lexFormula('0.5')).toEqual([{ value: 0.5 }]);
    expect(lexFormula('1')).toEqual([{ value: 1 }]);

    // :-(
    expect(lexFormula('.5')).toEqual([{ lookup: '.' }, { value: 5 }]);
    expect(() => lexFormula('0.')).toThrow(SyntaxError);
  });

  it('lexes incrementally how we would expect', () => {
    const stream = [
      { input: null, output: [] },
      { input: 'x', output: [] },
      { input: '+', output: [{ name: 'x' }, { op: '+' }] },
      { input: 'x', output: [] },
      { input: 'y', output: [] },
      { input: 'z', output: [] },
      { input: '>', output: [{ name: 'xyz' }] },
      { input: '=', output: [{ op: '>=' }] },
      { input: '(', output: [{ open: '(' }] },
      { input: '1', output: [] },
      { input: ')', output: [{ value: 1 }, { close: ')' }] },
      { input: '<', output: [] },
      { input: '6', output: [{ op: '<' }] },
      { input: null, output: [{ value: 6 }] },
    ];
    const gen = generatorLex();
    stream.forEach(({ input, output }) => {
      expect(gen.next(input).value).toEqual(output);
    });
  });
});
