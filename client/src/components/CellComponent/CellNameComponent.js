import React, { Component } from 'react';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';

const lookupNameStyle = { fontStyle: 'italic' };
const lookupText = name => [
  '\u21e8 ', // fat arrow, space
  <span key="smells" style={lookupNameStyle}>{name}</span>,
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
