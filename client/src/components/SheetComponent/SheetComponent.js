import React, { Component } from 'react';
import equal from 'fast-deep-equal';
import FormulaComponent from '../FormulaComponent/FormulaComponent';

import SheetContentsComponent from '../ContentsComponents/SheetContentsComponent';
import './SheetComponent.css';

class SheetComponent extends Component {
  constructor(props) {
    super(props);
    this.getFocus = this.getFocus.bind(this);
    this.setFormulaFocus = this.setFormulaFocus.bind(this);
    this.setFormulaRef = this.setFormulaRef.bind(this);
    this.popStack = this.popStack.bind(this);
    this.deleteSheet = this.deleteSheet.bind(this);
    this.pushStack = this.pushStack.bind(this);
    this.setFormulaSelection = this.setFormulaSelection.bind(this);
    this.setWindowSelection = this.setWindowSelection.bind(this);

    this.formulaRef = null;
    this.state = {
      formulaHasFocus: false,
      formulaSelection: null,
      selY: 0,
      selX: 0,
    };
  }

  getFocus() {
    const { setViewSelection, viewId } = this.props;
    setViewSelection(viewId);
  }

  setFormulaRef(ref) {
    this.formulaRef = ref;
  }

  setFormulaFocus(formulaHasFocus) {
    // callback used by formula component
    this.setState({ formulaHasFocus });
    if (formulaHasFocus) {
      this.getFocus();
    }
  }

  setFormulaSelection(newSelection) {
    // Reference to cell or x/y coords
    const { formulaSelection } = this.state;
    if (equal(formulaSelection, newSelection)) return;
    this.setState({ formulaSelection: newSelection });
  }

  setWindowSelection(y, x) {
    const { selX, selY } = this.state;
    this.getFocus();
    if (y === selY && x === selX) return;
    this.setState({ selY: y, selX: x });
  }

  // These two methods passed down to children so they can operate on the
  // parent BookComponent

  pushStack(cellId) {
    const { pushViewStack, viewId } = this.props;
    pushViewStack(viewId, cellId);
  }

  popStack() {
    const { popViewStack, viewId } = this.props;
    popViewStack(viewId);
  }

  deleteSheet() {
    const { deleteSheet, viewId } = this.props;
    deleteSheet(viewId);
  }

  render() {
    const {
      cellValuesById,
      children: sheetSelect,
      path,
      isChild,
      readOnly,
      selected,
      width,
      height,
      depth,
      sheetId,
      viewId,
    } = this.props;
    const {
      formulaHasFocus,
      formulaSelection,
      selY,
      selX,
    } = this.state;
    const style = {
      gridTemplateColumns: `repeat(${width}, auto)`,
      gridTemplateRows: `repeat(${height * 2}, 2.5ex)`,
      zIndex: depth + 1,
    };

    return (
      <div className="SheetContainer">
        <div className="SheetTitle">
          {path}
          {isChild && (
            <button
              onClick={this.popStack}
              className="StackButton"
            >
              &minus;
            </button>
          )}
          {!isChild && (
            <button
              onClick={this.deleteSheet}
              className="DeleteSheetButton"
            >
              &times;
            </button>
          )}
        </div>
        <div
          className="Sheet"
          style={style}
        >
          <SheetContentsComponent
            cellValuesById={cellValuesById}
            formulaRef={this.formulaRef}
            pushViewStack={this.pushStack}
            popViewStack={this.popStack}
            readOnly={readOnly}
            setFormulaSelection={this.setFormulaSelection}
            formulaHasFocus={formulaHasFocus}
            contextId={sheetId}
            viewHeight={height}
            viewWidth={width}
            viewSelected={selected}
            viewSelX={selX}
            viewSelY={selY}
            viewId={viewId}
            setViewSelection={this.setWindowSelection}
          />
        </div>
        <div className="SheetViewInputRow">
          <div ref={this.setFormulaPlaceRef} />
          <FormulaComponent
            readOnly={readOnly}
            ref={this.setFormulaRef}
            selection={formulaSelection}
            setFormulaHasFocus={this.setFormulaFocus}
            sheetId={sheetId}
          />
          {sheetSelect}
        </div>
      </div>
    );
  }
}

export default SheetComponent;
