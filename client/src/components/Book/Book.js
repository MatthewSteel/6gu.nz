import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { getSheets } from '../../selectors/formulas/selectors';
import { getDisplayView, getView } from '../../selectors/uistate/uistate';
import { getCellValuesById } from '../../selectors/formulas/codegen';
import store from '../../redux/store';
import { createSheet, deleteThing } from '../../redux/documentEditing';
import { updateView } from '../../redux/uistate';
import Sheet from '../Sheet/Sheet';
import TitleBar, { PathElem } from './TitleBar';
import DocumentMenu from '../DropDown/DocumentMenu';
import SheetMenu from '../DropDown/SheetMenu';

const mapStateToProps = state => ({
  cellValuesById: getCellValuesById(state),
  view: getView(state),
  displayView: getDisplayView(state),
  sheets: getSheets(state),
});

const mapDispatchToProps = dispatch => ({
  createSheetProp: () => dispatch(createSheet()),
  deleteSheet: sheetId => dispatch(deleteThing(sheetId)),
  updateViewProp: view => dispatch(updateView(view)),
});

class Book extends PureComponent {
  constructor(props) {
    super(props);
    this.pushStack = this.pushStack.bind(this);
    this.popStack = this.popStack.bind(this);
    this.setStackDepth = this.setStackDepth.bind(this);
    this.changeSheetViewSheet = this.changeSheetViewSheet.bind(this);
    this.deleteSheet = this.deleteSheet.bind(this);
  }

  changeSheetViewSheet(targetSheetId) {
    const { createSheetProp, updateViewProp } = this.props;

    if (targetSheetId !== 'new') {
      updateViewProp({ sheetId: targetSheetId, stack: [] });
      return;
    }
    // new sheet
    createSheetProp();

    // Is this bad practice? The sheet will not be in our props...
    const allSheets = getSheets(store.getState());
    const createdSheet = allSheets[allSheets.length - 1];
    updateViewProp({ sheetId: createdSheet.id, stack: [] });
  }

  pushStack(cellId) {
    const { updateViewProp, view } = this.props;
    const newStack = [...view.stack, { id: cellId }];
    updateViewProp({ ...view, stack: newStack });
  }

  popStack() {
    this.setStackDepth(this.props.view.stack.length - 1);
  }

  setStackDepth(n) {
    const { updateViewProp, view } = this.props;
    const newStack = view.stack.slice(0, n);
    updateViewProp({ ...view, stack: newStack });
  }

  deleteSheet(sheetId) {
    const { deleteSheet, sheets, updateViewProp, view } = this.props;
    if (sheets.length !== 1 && view.sheetId === sheetId) {
      // Select a sheet "near" the one currently selected.
      const sheetIndex = sheets.findIndex(({ id }) => id === sheetId);
      const newSelectedIndex = (sheetIndex === 0) ? 1 : sheetIndex - 1;
      const newSelectedSheetId = sheets[newSelectedIndex].id;
      updateViewProp({ ...view, sheetId: newSelectedSheetId });
    }
    deleteSheet(sheetId);
  }

  render() {
    const { displayView } = this.props;

    let path = '';
    const sheetViews = displayView.map(({ value, pathElem }, i) => {
      path += pathElem;
      const { template, byId } = value;
      return (
        <Sheet
          key={path}
          sheetId={template}
          cellValuesById={byId}
          readOnly={i !== 0}
          selected={i === displayView.length - 1}
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
      <div className="ViewClass">
        <TitleBar
          pathElems={stackPathElems}
          setStackDepth={this.setStackDepth}
        >
          <DocumentMenu />
          {stackPathElems.length === 0 ? (
            <SheetMenu
              deleteSheet={this.deleteSheet}
              selectSheet={this.changeSheetViewSheet}
            />
          ) : (
            <PathElem
              pathElem={sheetPathElem}
              depth={0}
              last={false}
              setStackDepth={this.setStackDepth}
            />
          )}
        </TitleBar>
        <div style={{ position: 'relative' }}>
          {sheetViews}
        </div>
      </div>
    );
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(Book);
