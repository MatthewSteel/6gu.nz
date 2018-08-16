import React, { Component } from 'react';
import './CellComponent.css';
import BaseCellComponent, { shouldCellComponentUpdate } from './BaseCellComponent';
import EditableLabel from '../util/EditableLabel';

class EmptyCellComponent extends Component {
  constructor(props) {
    super(props);
    this.writeValue = this.writeValue.bind(this);
  }

  shouldComponentUpdate(nextProps) {
    return shouldCellComponentUpdate(this.props, nextProps);
  }

  writeValue(val) {
    if (val === '') return;
    const maybeNumber = Number(val);
    const { writeLocValue } = this.props;
    if (!Number.isNaN(maybeNumber)) {
      writeLocValue(undefined, JSON.stringify(maybeNumber));
    } else {
      writeLocValue(undefined, JSON.stringify(val));
    }
  }

  render() {
    const { clickExpr, x, y, width, height, setSelection, writable } = this.props;
    return (
      <BaseCellComponent
        clickExpr={clickExpr}
        x={x}
        y={y}
        width={width}
        height={height}
        className="EmptyCell"
        setSelection={setSelection}
      >
        <EditableLabel label="" fn={writable ? this.writeValue : undefined} />
      </BaseCellComponent>
    );
  }
}
export default EmptyCellComponent;
