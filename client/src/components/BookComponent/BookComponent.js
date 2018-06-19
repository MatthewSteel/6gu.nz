import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getSheets } from '../../selectors/formulas/selectors';
import { getDisplayViews, getUiState } from '../../selectors/uistate/uistate';
import { getCellValuesById } from '../../selectors/formulas/codegen';
import store from '../../redux/store';
import { createSheet, deleteThing } from '../../redux/documentEditing';
import { setSelectedView, updateView } from '../../redux/uistate';
import SheetComponent from '../SheetComponent/SheetComponent';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  uistate: getUiState(state),
  displayViews: getDisplayViews(state),
  sheets: getSheets(state),
});

const mapDispatchToProps = dispatch => ({
  createSheetProp: () => dispatch(createSheet()),
  deleteSheet: sheetId => dispatch(deleteThing(sheetId)),
  setSelectedViewProp: view => dispatch(setSelectedView(view)),
  updateViewProp: view => dispatch(updateView(view)),
});

class BookComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.popStack = this.popStack.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.changeSheetViewSheet = this.changeSheetViewSheet.bind(this);
    this.deleteSelectedSheet = this.deleteSelectedSheet.bind(this);
  }

  setViewSelection(viewId) {
    const { setSelectedViewProp } = this.props;
    setSelectedViewProp(viewId);
  }

  getView(viewId) {
    const { views } = this.props.uistate;
    return views.find(({ id }) => id === viewId);
  }

  changeSheetViewSheet(ev) {
    const targetSheetId = ev.target.value;
    const viewId = ev.target.name;

    const { createSheetProp, updateViewProp } = this.props;

    if (targetSheetId !== 'new') {
      updateViewProp({ id: viewId, sheetId: targetSheetId, stack: [] });
      return;
    }
    // new sheet
    createSheetProp();

    // Is this bad practice? The sheet will not be in our props...
    const allSheets = getSheets(store.getState());
    const createdSheet = allSheets[allSheets.length - 1];
    updateViewProp({ id: viewId, sheetId: createdSheet.id, stack: [] });
  }

  pushStack(viewId, cellId) {
    const view = this.getView(viewId);
    const newStack = [...view.stack, { id: cellId }];
    this.props.updateViewProp({ ...view, stack: newStack });
  }

  popStack(viewId, n = 1) {
    const view = this.getView(viewId);
    const newStack = view.stack.slice(0, view.stack.length - n);
    this.props.updateViewProp({ ...view, stack: newStack });
  }

  deleteSelectedSheet(viewId) {
    const view = this.getView(viewId);
    const { deleteSheet, sheets, updateViewProp } = this.props;
    if (sheets.length !== 0) {
      // Select a sheet "near" the one currently selected.
      const sheetIndex = sheets.find(({ id }) => id === view.sheetId);
      if (sheetIndex === 0) {
        updateViewProp({ ...view, sheetId: sheets[1].id });
      } else {
        updateViewProp({ ...view, sheetId: sheets[sheetIndex - 1].id });
      }
    }
    deleteSheet(view.sheetId);
  }

  render() {
    const { displayViews, sheets, uistate } = this.props;
    const { selectedViewId, views } = uistate;

    const sheetComponents = displayViews.map((displayView, viewIndex) => {
      const viewId = views[viewIndex].id;
      const selectedSheet = views[viewIndex].sheetId;
      let path = '';
      const sheetViews = displayView.map(({ value, pathElem }, i) => {
        path += pathElem;
        const { template, byId } = value;
        return (
          <SheetComponent
            key={path}
            path={path}
            viewId={viewId}
            sheetId={template}
            cellValuesById={byId}
            readOnly={i !== 0}
            selected={selectedViewId === viewId && i === displayView.length - 1}
            setViewSelection={this.setViewSelection}
            isChild={i !== 0}
            deleteSheet={this.deleteSelectedSheet}
            popViewStack={this.popStack}
            pushViewStack={this.pushStack}
            height={13}
            width={10}
            depth={i}
          >
            <select
              className="ViewSelect"
              name={viewId}
              value={selectedSheet}
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
        );
      });
      return (
        <div key={viewId} style={{ display: 'grid' }}>
          {sheetViews}
        </div>
      );
    });

    return (
      <div>
        {sheetComponents}
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(BookComponent);
