import React, { Component } from 'react';
import FormulaComponent from '../FormulaComponent/FormulaComponent';

import SheetContentsComponent from './SheetContentsComponent';
import './SheetComponent.css';

class SheetComponent extends Component {
  constructor(props) {
    super(props);
    this.getFocus = this.getFocus.bind(this);
    this.setFormulaFocus = this.setFormulaFocus.bind(this);
    this.setFormulaRef = this.setFormulaRef.bind(this);
    this.popStack = this.popStack.bind(this);
    this.pushStack = this.pushStack.bind(this);
    this.setFormulaSelectionCellId = this.setFormulaSelectionCellId.bind(this);

    this.formulaRef = null;
    this.state = {
      formulaHasFocus: false,
      formulaSelectionCellId: null,
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

  setFormulaSelectionCellId(cellId) {
    const { formulaSelectionCellId } = this.state;
    if (formulaSelectionCellId === cellId) return;
    this.setState({ formulaSelectionCellId: cellId });
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
    } = this.props;
    const { formulaHasFocus, formulaSelectionCellId } = this.state;
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
            <button onClick={this.popStack} className="StackButton">&times;</button>
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
            setFormulaSelectionId={this.setFormulaSelectionCellId}
            formulaHasFocus={formulaHasFocus}
            sheetId={sheetId}
            getViewFocus={this.getFocus}
            viewHeight={height}
            viewWidth={width}
            viewSelected={selected}
          />
        </div>
        <div className="SheetViewInputRow">
          <div ref={this.setFormulaPlaceRef} />
          <FormulaComponent
            readOnly={readOnly}
            ref={this.setFormulaRef}
            selection={formulaSelectionCellId}
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
