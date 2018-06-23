import sizeMe from 'react-sizeme';
import React, { Component } from 'react';
import equal from 'fast-deep-equal';
import Formula from '../Formula/Formula';

import SheetContentsComponent from '../ContentsComponents/SheetContentsComponent';
import './Sheet.css';

class Sheet extends Component {
  constructor(props) {
    super(props);
    this.setFormulaFocus = this.setFormulaFocus.bind(this);
    this.setFormulaRef = this.setFormulaRef.bind(this);
    this.popStack = this.popStack.bind(this);
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

  setFormulaRef(ref) {
    this.formulaRef = ref;
  }

  setFormulaFocus(formulaHasFocus) {
    // callback used by formula component
    this.setState({ formulaHasFocus });
  }

  setFormulaSelection(newSelection) {
    // Reference to cell or x/y coords
    const { formulaSelection } = this.state;
    if (equal(formulaSelection, newSelection)) return;
    this.setState({ formulaSelection: newSelection });
  }

  setWindowSelection(y, x) {
    const { selX, selY } = this.state;
    if (y === selY && x === selX) return;
    this.setState({ selY: y, selX: x });
  }

  // These two methods passed down to children so they can operate on the
  // parent Book. Push for the [+] symbol, pop for ESC on the keyboard.

  pushStack(cellId) {
    const { pushViewStack } = this.props;
    pushViewStack(cellId);
  }

  popStack() {
    const { popViewStack } = this.props;
    popViewStack();
  }

  render() {
    const {
      cellValuesById,
      readOnly,
      selected,
      width,
      height,
      depth,
      sheetId,
    } = this.props;
    const {
      formulaHasFocus,
      formulaSelection,
      selY,
      selX,
    } = this.state;
    const style = {
      gridTemplateColumns: `repeat(${width}, 1fr)`,
      gridTemplateRows: `repeat(${height * 2}, 2.2ex)`,
      zIndex: depth + 1,
    };

    return (
      <div className="SheetContainer">
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
            setViewSelection={this.setWindowSelection}
          />
        </div>
        <div className="SheetViewInputRow">
          <div ref={this.setFormulaPlaceRef} />
          <Formula
            readOnly={readOnly}
            ref={this.setFormulaRef}
            selection={formulaSelection}
            setFormulaHasFocus={this.setFormulaFocus}
            sheetId={sheetId}
          />
        </div>
      </div>
    );
  }
}

const sizeMeHoc = sizeMe({
  monitorWidth: true,
  monitorHeight: true,
});

export default sizeMeHoc(Sheet);
