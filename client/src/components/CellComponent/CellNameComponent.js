import React, { Component } from 'react';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';
import EditableLabel from '../util/EditableLabel';

const lookupNameStyle = { fontStyle: 'italic' };
const lookupText = name => [
  <span key="react smells" style={lookupNameStyle}>{name}</span>,
  ' \u21e8', // space, fat arrow
];

class CellNameComponent extends Component {
  constructor(props) {
    super(props);
    this.rename = this.rename.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    return shouldCellComponentUpdate(this.props, nextProps);
  }

  rename(name) {
    if (name === '') return;
    const { renameFn } = this.props;
    renameFn(name, undefined);
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
      renameFn,
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
        <EditableLabel
          fn={renameFn ? this.rename : undefined}
          label={isLookup ? lookupText(name) : name}
          defaultName={name === undefined ? '' : name}
        />
      </BaseCellComponent>
    );
  }
}

export default CellNameComponent;
