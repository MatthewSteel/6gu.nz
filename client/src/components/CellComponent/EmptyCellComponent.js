import React, { Component } from 'react';
import deepEq from 'fast-deep-equal';
import shallowEq from 'is-equal-shallow';
import './CellComponent.css';
import BaseCellComponent from './BaseCellComponent';

class EmptyCellComponent extends Component {
  shouldComponentUpdate(nextProps) {
    const { clickExpr: oldClickExpr, ...oldShallowProps } = this.props;
    const { clickExpr: newClickExpr, ...newShallowProps } = nextProps;
    if (!deepEq(oldClickExpr, newClickExpr)) return true;
    return !shallowEq(oldShallowProps, newShallowProps);
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
