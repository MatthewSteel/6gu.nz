import { lexFormula } from './lexer';

describe('lexFormula', () => {
  it('lexes a simple assignment', () => {
    expect(lexFormula('foo=bar')).toEqual([
      { name: 'foo' },
      { assignment: '=' },
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
    expect(lexFormula(' =func( sheet.cell=0).value')).toEqual([
      { assignment: '=' },
      { name: 'func' },
      { open: '(' },
      { name: 'sheet' },
      { lookup: '.' },
      { name: 'cell' },
      { assignment: '=' },
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
});
