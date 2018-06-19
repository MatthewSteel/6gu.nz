import { digMut } from './algorithms';

describe('digMut', () => {
  it('puts does not change the original', () => {
    const before = { a: { b: { value: 10 } } };
    const after = digMut(before, ['a', 'b', 'value'], 20);
    expect(before).toEqual({ a: { b: { value: 10 } } });
    expect(after).toEqual({ a: { b: { value: 20 } } });
  });

  it('leaves peer entries alone', () => {
    const before = { a: { b: { value: 10 } } };
    const after = digMut(before, ['a', 'b', 'other'], 20);
    expect(after).toEqual({ a: { b: { value: 10, other: 20 } } });
  });
});
