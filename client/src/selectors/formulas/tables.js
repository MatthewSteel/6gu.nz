export class TableArray {
  constructor(rows) {
    this.arr = rows;
    this.keys = null;
    this.memoizedCols = null;
    this.lookupMemo = null;
  }

  initKeys() {
    if (this.keys) return; // already initialised

    // Check it's a table
    const firstValue = this.arr.find(cell => cell && cell.value);
    if (!firstValue) return;
    const { byName } = firstValue.value;
    if (!byName) return;

    // Set keys and memoized cols
    this.keys = Object.keys(byName);
    this.keys.sort().reverse(); // reverse alpha for now because it looks dumb.
    this.memoizedCols = {};
  }

  setLookupMemo(memo) {
    this.lookupMemo = memo;
  }

  isTable() {
    // Could just contain values, or other arrays.
    // Just use this for display purposes, we really can't tell with an
    // array of undefined values -- no proper type checking.
    this.initKeys();
    return !!this.keys;
  }

  getColumn(colName) {
    this.initKeys();
    const maybeRet = this.memoizedCols[colName];
    if (maybeRet) return maybeRet;

    const ret = new TableArray(this.arr.map((row) => {
      // maybe we should raise on whole-row errors?
      if (row.error) return { error: row.error };
      try {
        return { value: getNamedMember(row.value, colName) };
      } catch (e) {
        return { error: e.toString() };
      }
    }));
    this.memoizedCols[colName] = ret;
    return ret;
  }
}

export const getType = (value) => {
  // Just for our complex data types for now. For display.
  // If it's a table literal, we might be able to tell by the cell type.
  if (value == null) return 'primitive'; // for display, regular cell
  if (value.byName) return 'object';
  if (value instanceof TableArray) {
    if (value.isTable()) return 'table';
    return 'array';
  }
  return 'primitive'; // probably...
};

export const getNamedMember = (value, colName) => {
  // Either a table or a struct. Maybe we should use polymorphism?
  // (Should this also be recursive?)
  if (value instanceof TableArray) return value.getColumn(colName);
  const { byName } = value;
  if (!byName) throw new Error('Lookup value is not an object');
  const entry = byName[colName];
  if (!entry) {
    throw new Error(`Lookup item does not have a field "${colName}"`);
  }
  if ('value' in entry) return entry.value;
  throw new Error(entry.error);
};

export const getNumberedMember = (value, index) => {
  if (index instanceof TableArray) {
    return new TableArray(index.arr.map((elem) => {
      if (elem.error) return elem;
      return { value: getNumberedMember(value, elem.value) };
    }));
  }
  if (value instanceof TableArray) {
    const ret = value.arr[index];
    if (!ret) return null;
    if (ret.error) throw new Error(ret.error);
    return ret.value;
  }
  if (typeof value === 'string') {
    const ret = value.charAt(index);
    if (ret) return ret;
    throw new Error(`Index ${index} out of bounds`);
  }
  throw new Error('Indexing[] not allowed on this value');
};
