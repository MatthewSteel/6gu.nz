const translateCol = (c) => {
  const a = 97;
  if (c < 26) return String.fromCharCode(a + c);

  const chars = [];
  let col = c + 1;
  while (col > 0) {
    const remainder = col % 26;
    if (remainder === 0) {
      chars.push('z');
      col = Math.trunc(col / 26) - 1;
    } else {
      chars.push(String.fromCharCode(a + (remainder - 1)));
      col = Math.trunc(col / 26);
    }
  }
  return chars.reverse().join('');
};

export default (row, col) => `${translateCol(col)}${row + 1}`;
