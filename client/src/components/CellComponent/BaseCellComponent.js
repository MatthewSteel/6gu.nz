import React, { Component } from 'react';
import deepEq from 'fast-deep-equal';
import shallowEq from 'is-equal-shallow';
import './CellComponent.css';

export const shouldCellComponentUpdate = (oldProps, nextProps) => {
  const { clickExpr: oldClickExpr, ...oldShallowProps } = oldProps;
  const { clickExpr: newClickExpr, ...newShallowProps } = nextProps;
  if (!deepEq(oldClickExpr, newClickExpr)) return true;
  return !shallowEq(oldShallowProps, newShallowProps);
};

class BaseCellComponent extends Component {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
    this.maybePreventClick = this.maybePreventClick.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    return shouldCellComponentUpdate(this.props, nextProps);
  }

  maybePreventClick(ev) {
    // not draggable when the formula has focus
    // preventing default here stops the formula box from blurring when we do
    // click-to-write-formula actions.
    if (!this.props.onDragStart) ev.preventDefault();
  }

  onClick(ev) {
    ev.preventDefault();
    const { x, y, clickExpr, setSelection } = this.props;
    setSelection(y, x, clickExpr);
  }

  bounds() {
    const { x, y, width, height } = this.props;
    return {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${(2 * y) + 1} / span ${2 * height}`,
    };
  }

  render() {
    const {
      children,
      className,
      title,
      onDragStart,
      onDragEnd,
    } = this.props;
    const style = this.bounds();
    return (
      <div
        className={className}
        style={style}
        onClick={this.onClick}
        onMouseDown={this.maybePreventClick}
        onDragStart={onDragStart || undefined}
        onDragEnd={onDragEnd || undefined}
        title={title}
        draggable={!!(onDragStart && onDragEnd)}
      >
        {children}
      </div>
    );
  }
}

export default BaseCellComponent;
