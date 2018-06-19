export const SHEET = 'sheet';
export const CELL = 'cell';
export const ARRAY = 'array';
export const ARRAY_CELL = 'array_cell';
export const OBJECT = 'object';
export const OBJECT_CELL = 'object_cell';
export const TABLE = 'table';
export const TABLE_ROW = 'table_row';
export const TABLE_COLUMN = 'table_column';
export const COMPUTED_TABLE_COLUMN = 'computed_table_column';
export const TABLE_CELL = 'table_cell';

export const loggedOutDocs = [];

export const LOGIN_STATES = {
  UNKNOWN: 'UNKNOWN',
  LOGGED_IN: 'LOGGED_IN',
  LOGGED_OUT: 'LOGGED_OUT',
};

export const BLANK_DRAG_STATE = {};

const DEFAULT_VIEWS = {
  selectedViewId: '0',
  views: [{
    id: '0',
    sheetId: undefined,
    stack: [],
  }],
};

export const initialState = {
  userState: {
    loginState: LOGIN_STATES.UNKNOWN,
    documents: loggedOutDocs,
  },
  dragState: BLANK_DRAG_STATE,
  uistate: DEFAULT_VIEWS,
};

export const path = terminalName => ({
  updateId: ['openDocument', 'updateId'],
  cells: ['openDocument', 'data', 'cells'],
  sheets: ['openDocument', 'data', 'sheets'],
  data: ['openDocument', 'data'],
  dragState: ['dragState'],
}[terminalName]);
