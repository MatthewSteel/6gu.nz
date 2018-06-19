import { createSelector } from 'reselect';
import { getCellValuesById } from '../formulas/codegen';
import { getRefsById, getSheets, getSheetsById } from '../formulas/selectors';
import { unparseName } from '../formulas/unparser';

const normaliseView = (view, sheets, sheetsById, cellValuesById) => {
  if (!sheetsById[view.sheetId]) {
    const sheetId = sheets[0].id;
    return {
      ...view,
      sheetId,
      stack: [],
    };
  }
  const stack = [];
  const ret = {
    ...view,
    stack,
  };
  let currentValue = cellValuesById[ret.sheetId].value;
  try {
    view.stack.forEach((stackElem) => {
      let value;
      if (stackElem.id) {
        value = currentValue.byId[stackElem.id];
      } else if (stackElem.name) {
        value = currentValue.byName[stackElem.name];
      } else if ('index' in stackElem) {
        value = currentValue.arr[stackElem.index];
      }
      if (value.error) throw new Error('bail :-)');
      currentValue = value.value;
      if (!currentValue.template) throw new Error('FIXME');
      stack.push(stackElem);
    });
  } catch (e) {
    // Bad path. Oh well.
  }
  return ret;
};

const rawViews = state => state.uistate.views;

export const getSelectedViewId = state => state.uistate.selectedViewId;

export const getViews = createSelector(
  rawViews,
  getSheets,
  getSheetsById,
  getCellValuesById,
  (views, sheets, sheetsById, cellValuesById) => views.map(view => (
    normaliseView(view, sheets, sheetsById, cellValuesById))),
);

export const getDisplayViews = createSelector(
  getCellValuesById,
  getRefsById,
  getViews,
  (cellValuesById, refsById, views) => views.map((view) => {
    const pathElem = refsById[view.sheetId].name;
    const stack = [{
      value: cellValuesById[view.sheetId].value,
      pathElem,
    }];
    view.stack.forEach((stackElem) => {
      const prevValue = stack[stack.length - 1].value;
      if ('index' in stackElem) {
        stack.push({
          pathElem: `[${stackElem.index}]`,
          value: prevValue.arr[stackElem.index].value,
        });
      } else if (stackElem.name) {
        stack.push({
          pathElem: `.${unparseName(stackElem.name)}`,
          value: prevValue.byName[stackElem.index].value,
        });
      } else {
        const { name } = refsById[stackElem.id];
        stack.push({
          pathElem: `.${unparseName(name)}`,
          value: prevValue.byId[stackElem.id].value,
        });
      }
    });
    return stack;
  }),
);
