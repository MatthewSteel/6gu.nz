import React, { Component } from 'react';
import deepEq from 'fast-deep-equal';
import shallowEq from 'is-equal-shallow';
import BaseCellComponent from './BaseCellComponent';

class CellNameComponent extends Component {
  shouldComponentUpdate(nextProps) {
    const { clickExpr: oldClickExpr, ...oldShallowProps } = this.props;
    const { clickExpr: newClickExpr, ...newShallowProps } = nextProps;
    if (!deepEq(oldClickExpr, newClickExpr)) return true;
    return !shallowEq(oldShallowProps, newShallowProps);
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
