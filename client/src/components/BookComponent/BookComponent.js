import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getSheets } from '../../selectors/formulas/selectors';
import { getDisplayViews, getSelectedViewId, getViews } from '../../selectors/uistate/uistate';
import { getCellValuesById } from '../../selectors/formulas/codegen';
import store from '../../redux/store';
import { createSheet, deleteThing } from '../../redux/documentEditing';
import { setSelectedView, updateView } from '../../redux/uistate';
import SheetComponent from '../SheetComponent/SheetComponent';
import TitleBar, { PathElem } from './TitleBar';
import DocumentMenu from '../DropDown/DocumentMenu';
import SheetMenu from '../DropDown/SheetMenu';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  selectedViewId: getSelectedViewId(state),
  views: getViews(state),
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
    this.setStackDepth = this.setStackDepth.bind(this);
    this.setViewSelection = this.setViewSelection.bind(this);
    this.changeSheetViewSheet = this.changeSheetViewSheet.bind(this);
    this.deleteSheet = this.deleteSheet.bind(this);
  }

  setViewSelection(viewId) {
    const { setSelectedViewProp } = this.props;
    setSelectedViewProp(viewId);
  }

  getView(viewId) {
    const { views } = this.props;
    return views.find(({ id }) => id === viewId);
  }

  changeSheetViewSheet(viewId, targetSheetId) {
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

  popStack(viewId) {
    const view = this.getView(viewId);
    this.setStackDepth(viewId, view.stack.length - 1);
  }

  setStackDepth(viewId, n) {
    const view = this.getView(viewId);
    const newStack = view.stack.slice(0, n);
    this.props.updateViewProp({ ...view, stack: newStack });
  }

  deleteSheet(sheetId) {
    const { deleteSheet, sheets, updateViewProp, views } = this.props;
    if (sheets.length !== 1) {
      // Select a sheet "near" the one currently selected.
      const sheetIndex = sheets.findIndex(({ id }) => id === sheetId);
      const newSelectedIndex = (sheetIndex === 0) ? 1 : sheetIndex - 1;
      const newSelectedSheetId = sheets[newSelectedIndex].id;
      views.forEach((view) => {
        if (view.sheetId === sheetId) {
          updateViewProp({ ...view, sheetId: newSelectedSheetId });
        }
      });
    }
    deleteSheet(sheetId);
  }

  render() {
    const { displayViews, selectedViewId, views } = this.props;

    const sheetComponents = displayViews.map((displayView, viewIndex) => {
      const viewId = views[viewIndex].id;
      let path = '';
      const sheetViews = displayView.map(({ value, pathElem }, i) => {
        path += pathElem;
        const { template, byId } = value;
        return (
          <SheetComponent
            key={path}
            viewId={viewId}
            sheetId={template}
            cellValuesById={byId}
            readOnly={i !== 0}
            selected={selectedViewId === viewId && i === displayView.length - 1}
            setViewSelection={this.setViewSelection}
            deleteSheet={this.deleteSelectedSheet}
            popViewStack={this.popStack}
            pushViewStack={this.pushStack}
            height={13}
            width={10}
            depth={i}
          />
        );
      });
      const [
        sheetPathElem,
        ...stackPathElems
      ] = displayView.map(({ pathElem }) => pathElem);
      return (
        <div className="ViewClass" key={viewId}>
          <TitleBar
            viewId={viewId}
            pathElems={stackPathElems}
            setStackDepth={this.setStackDepth}
          >
            <DocumentMenu />
            {stackPathElems.length === 0 ? (
              <SheetMenu
                viewId={viewId}
                deleteSheet={this.deleteSheet}
                selectSheet={this.changeSheetViewSheet}
              />
            ) : (
              <PathElem
                pathElem={sheetPathElem}
                depth={0}
                viewId={viewId}
                last={false}
                setStackDepth={this.setStackDepth}
              />
            )}
          </TitleBar>
          <div key={viewId} style={{ position: 'relative' }}>
            {sheetViews}
          </div>
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
