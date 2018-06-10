import { clampOverlap } from './geom';

describe('clampOverlap', () => {
  it('handles cases that do not overlap', () => {
    expect(clampOverlap(0, 2, 0, 10)).toBe(0);
    expect(clampOverlap(2, 2, 0, 10)).toBe(2);
    expect(clampOverlap(8, 2, 0, 10)).toBe(8);

    expect(clampOverlap(0, 10, 0, 10)).toBe(0);
    expect(clampOverlap(-5, 20, 0, 10)).toBe(-5);
  });

  it('moves things below the range up until they go into range', () => {
    expect(clampOverlap(-10, 2, 0, 10)).toBe(-1);
    expect(clampOverlap(-5, 2, 0, 10)).toBe(-1);
  });

  it('moves things above the range down until they go in', () => {
    expect(clampOverlap(10, 20, 0, 10)).toBe(9);
    expect(clampOverlap(25, 20, 0, 10)).toBe(9);
  });
});
