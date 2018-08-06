import sizeMe from 'react-sizeme';
import React, { Component } from 'react';

import SheetContentsComponent from '../ContentsComponents/SheetContentsComponent';
import './Sheet.css';

class Sheet extends Component {
  constructor(props) {
    super(props);
    this.popStack = this.popStack.bind(this);
    this.pushStack = this.pushStack.bind(this);
    this.setWindowSelection = this.setWindowSelection.bind(this);

    this.state = { selY: 0, selX: 0 };
  }

  setWindowSelection(y, x, maybeClickExpr) {
    const { maybeInsertExprIntoFormula } = this.props;
    if (maybeClickExpr && maybeInsertExprIntoFormula(maybeClickExpr)) return;

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
      size,
      sheetId,
    } = this.props;
    const {
      selY,
      selX,
    } = this.state;
    const width = Math.ceil(size.width / 100);
    const height = Math.ceil((size.height - 20) / 40);
    const style = {
      gridTemplateColumns: `repeat(${width}, 100px)`,
      gridTemplateRows: `repeat(${height * 2}, 20px)`,
    };

    return (
      <div className="Sheet" style={style}>
        <SheetContentsComponent
          cellValuesById={cellValuesById}
          pushViewStack={this.pushStack}
          popViewStack={this.popStack}
          readOnly={readOnly}
          contextId={sheetId}
          viewHeight={height}
          viewWidth={width}
          viewSelected={selected}
          viewSelX={selX}
          viewSelY={selY}
          setViewSelection={this.setWindowSelection}
        />
      </div>
    );
  }
}

const sizeMeHoc = sizeMe({ monitorWidth: true, monitorHeight: true });
export default sizeMeHoc(Sheet);
