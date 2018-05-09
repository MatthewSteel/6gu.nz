import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import {
  getCellValuesById,
  getSheets,
  getSheetsById,
  getRefsById,
} from '../../selectors/formulas/selectors';
import store, {
  createSheet,
  deleteThing,
  loadFile,
} from '../../redux/store';
import SheetComponent from '../SheetComponent/SheetComponent';
import FileComponent from '../FileComponent/FileComponent';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  refsById: getRefsById(state),
  sheetsById: getSheetsById(state),
  sheets: getSheets(state),
});

const mapDispatchToProps = dispatch => ({
  loadFileProp: () => dispatch(loadFile()),
  createSheetProp: () => dispatch(createSheet()),
  deleteSheet: sheetId => dispatch(deleteThing(sheetId)),
});

class BookComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.popStack = this.popStack.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.changeSheetViewSheet = this.changeSheetViewSheet.bind(this);
    this.deleteSelectedSheet = this.deleteSelectedSheet.bind(this);
    this.state = {
      selectedViewId: '0',
      views: [{
        id: '0',
        stack: [],
        sheetId: props.sheets[0].id,
      }, {
        id: '1',
        stack: [],
        sheetId: props.sheets[1].id,
      }],
    };
  }

  setViewSelection(viewId) {
    this.setState({ selectedViewId: viewId });
  }

  getView(viewId) {
    const view = this.state.views.find(({ id }) => id === viewId);
    return this.normaliseView(view);
  }

  updateView(newView) {
    this.setState({
      selectedViewId: newView.id,
      views: this.state.views.map(view => (
        view.id === newView.id ? newView : view)),
    });
  }

  normaliseView(view) {
    // A view stack may have invalid entries after some redux state update.
    // The view is robust at the moment (maybe it shouldn't need to be...)
    // but pushing/popping on a broken stack is no good. Fix it up before
    // working on it.
    const { stack, sheetId } = view;
    let sheetData = this.props.cellValuesById[sheetId];
    const newStack = [];
    stack.forEach((stackRef) => {
      if (sheetData && sheetData.byId[stackRef]) {
        sheetData = sheetData.byId[stackRef].value;
        newStack.push(stackRef);
      } else {
        sheetData = null;
      }
    });
    return {
      ...view,
      stack: newStack,
    };
  }

  changeSheetViewSheet(ev) {
    const targetSheetId = ev.target.value;
    const viewId = ev.target.name;
    if (targetSheetId !== 'new') {
      this.updateView({ id: viewId, sheetId: targetSheetId, stack: [] });
      return;
    }
    // new sheet
    const { createSheetProp } = this.props;
    createSheetProp();

    // Is this bad practice? The sheet will not be in our props...
    const allSheets = getSheets(store.getState());
    const createdSheet = allSheets[allSheets.length - 1];
    this.updateView({ id: viewId, sheetId: createdSheet.id, stack: [] });
  }

  pushStack(viewId, cellId) {
    const view = this.getView(viewId);
    const newStack = [...view.stack, cellId];
    this.updateView({ ...view, stack: newStack });
  }

  popStack(viewId, n = 1) {
    const view = this.getView(viewId);
    const newStack = view.stack.slice(0, view.stack.length - n);
    this.updateView({ ...view, stack: newStack });
  }

  deleteSelectedSheet(viewId) {
    const view = this.getView(viewId);
    const { createSheetProp, deleteSheet, sheets } = this.props;
    if (sheets.length === 1) createSheetProp();

    // Possible new sheet may not be in `sheets`.
    const allSheets = getSheets(store.getState());

    const sheetIndex = allSheets.findIndex(({ id }) => id === view.sheetId);
    const newViewSheetIndex = sheetIndex + (sheetIndex === allSheets.length - 1 ? -1 : 1);
    const newViewSheetId = allSheets[newViewSheetIndex].id;
    this.updateView({ id: viewId, stack: [], sheetId: newViewSheetId });
    deleteSheet(allSheets[sheetIndex].id);
  }

  render() {
    const {
      refsById,
      cellValuesById,
      sheets,
      loadFileProp,
      sheetsById,
    } = this.props;
    const { selectedViewId, views } = this.state;

    const sheetComponents = views.map(({ id, stack, sheetId }) => {
      const selectedSheet = sheetsById[sheetId] || sheets[0];
      const sheetName = selectedSheet.name;
      const viewData = [{
        ...cellValuesById[selectedSheet.id],
        path: sheetName,
      }];
      let pathStillValid = true;
      stack.forEach((stackRef) => {
        const lastViewData = viewData[viewData.length - 1];
        const newData = lastViewData.byId[stackRef];
        pathStillValid = pathStillValid && newData;
        if (pathStillValid) {
          const { name } = refsById[stackRef];
          viewData.push({
            ...newData.value,
            path: `${lastViewData.path}.${name}`,
          });
        }
      });

      const sheetViews = viewData.map(({ template, byId, path }, i) => (
        <SheetComponent
          key={path}
          path={path}
          viewId={id}
          sheetId={template}
          cellValuesById={byId}
          readOnly={i !== 0}
          selected={selectedViewId === id && i === viewData.length - 1}
          setViewSelection={this.setViewSelection}
          isChild={i !== 0}
          deleteSheet={this.deleteSelectedSheet}
          popViewStack={this.popStack}
          pushViewStack={this.pushStack}
          height={5}
          width={6}
          depth={i}
        >
          <select
            className="ViewSelect"
            name={id}
            value={selectedSheet.id}
            onChange={this.changeSheetViewSheet}
          >
            {sheets.map(sheet => (
              <option
                key={sheet.id}
                value={sheet.id}
              >
                {sheet.name}
              </option>
            ))}
            <option
              key="new"
              value="new"
            >
              {'{New sheet}'}
            </option>
          </select>
        </SheetComponent>
      ));
      return (
        <div key={id} style={{ display: 'grid' }}>
          {sheetViews}
        </div>
      );
    });

    return (
      <div>
        {sheetComponents}
        <FileComponent
          loadFile={loadFileProp}
        />
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookComponent);
