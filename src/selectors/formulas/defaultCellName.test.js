import defaultCellName from './defaultCellName';

describe('defaultCellName', () => {
  it('gives the right answers', () => {
    expect(defaultCellName(0, 0)).toBe('A1');
    expect(defaultCellName(0, 1)).toBe('B1');
    expect(defaultCellName(0, 25)).toBe('Z1');
    expect(defaultCellName(0, 26)).toBe('AA1');
    expect(defaultCellName(0, 27)).toBe('AB1');
    expect(defaultCellName(0, (26 * 26) - 1)).toBe('YZ1');
    expect(defaultCellName(0, 26 * 26)).toBe('ZA1');
    expect(defaultCellName(0, (27 * 26) - 1)).toBe('ZZ1');
    expect(defaultCellName(0, (27 * 26))).toBe('AAA1');
  });
});
