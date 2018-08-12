import React, { Component } from 'react';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';

const lookupNameStyle = { fontStyle: 'italic' };
const lookupText = name => [
  <span key="react smells" style={lookupNameStyle}>{name}</span>,
  ' \u21e8', // space, fat arrow
];

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
      isLookup,
    } = this.props;
    const contents = isLookup ? lookupText(name) : name;
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
        {contents}
      </BaseCellComponent>
    );
  }
}

export default CellNameComponent;
