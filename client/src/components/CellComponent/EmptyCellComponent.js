import React, { Component } from 'react';
import './CellComponent.css';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';

class EmptyCellComponent extends Component {
  shouldComponentUpdate(nextProps) {
    return shouldCellComponentUpdate(this.props, nextProps);
  }

  render() {
    const { clickExpr, x, y, width, height, setSelection } = this.props;
    return (
      <BaseCellComponent
        clickExpr={clickExpr}
        x={x}
        y={y}
        width={width}
        height={height}
        className="EmptyCell"
        setSelection={setSelection}
      />
    );
  }
}
export default EmptyCellComponent;
