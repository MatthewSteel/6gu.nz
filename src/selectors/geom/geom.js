const rangesOverlap = (x1, length1, x2, length2) =>
  !(x1 + length1 <= x2 || x2 + length2 <= x1);

export const overlaps = (y1, height1, x1, width1, cell) => {
  const {
    x: x2,
    y: y2,
    width: width2,
    height: height2,
  } = cell;
  return rangesOverlap(y1, height1, y2, height2) &&
    rangesOverlap(x1, width1, x2, width2);
};

export const clampOverlap = (x, length, lower, upper) => {
  // both ranges are half-open
  // returns new x value
  if (x + length <= lower) return (lower - length) + 1;
  if (upper <= x) return upper - 1;
  return x;
};
