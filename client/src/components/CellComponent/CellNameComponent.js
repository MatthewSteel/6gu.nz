import React, { Component } from 'react';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';

class CellNameComponent extends Component {
  shouldComponentUpdate(nextProps) {
    return shouldCellComponentUpdate(this.props, nextProps);
  }

  render() {
    const {
      clickExpr,
      x,
      y,
      width,
      height,
      name,
      setSelection,
      onDragStart,
      onDragEnd,
    } = this.props;
    return (
      <BaseCellComponent
        clickExpr={clickExpr}
        x={x}
        y={y}
        width={width}
        height={height}
        className="CellName"
        setSelection={setSelection}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
      >
        {name}
      </BaseCellComponent>
    );
  }
}

export default CellNameComponent;
