import defaultCellName from './defaultCellName';

describe('defaultCellName', () => {
  it('gives the right answers', () => {
    expect(defaultCellName(0, 0)).toBe('a1');
    expect(defaultCellName(0, 1)).toBe('b1');
    expect(defaultCellName(0, 25)).toBe('z1');
    expect(defaultCellName(0, 26)).toBe('aa1');
    expect(defaultCellName(0, 27)).toBe('ab1');
    expect(defaultCellName(0, (26 * 26) - 1)).toBe('yz1');
    expect(defaultCellName(0, 26 * 26)).toBe('za1');
    expect(defaultCellName(0, (27 * 26) - 1)).toBe('zz1');
    expect(defaultCellName(0, (27 * 26))).toBe('aaa1');
  });
});
