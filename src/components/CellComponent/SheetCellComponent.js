import React, { PureComponent } from 'react';
import CellNameComponent from './CellNameComponent';
import CellValueComponent from './CellValueComponent';
import CellSelectionComponent from './CellSelectionComponent';

import { DRAG_MOVE } from '../../selectors/geom/dragGeom';

import './CellComponent.css';

class SheetCellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onNameDragStart = this.onNameDragStart.bind(this);
  }

  onNameDragStart(ev) {
    ev.dataTransfer.setData(
      'text/plain',
      JSON.stringify({ spreadSheetData: true }),
    );
    const { id, startDragCallback } = this.props;
    startDragCallback(id, DRAG_MOVE);
  }

  render() {
    const {
      id,
      pushViewStack,
      name,
      x,
      y,
      width,
      height,
      selected,
      setSelection,
      value,
      endDragCallback,
    } = this.props;

    return (
      <CellSelectionComponent
        x={x}
        y={y}
        width={width}
        height={height}
        selected={selected}
      >
        <CellNameComponent
          name={name}
          x={x}
          y={y}
          width={width}
          height={0.5}
          selected={selected}
          setSelection={setSelection}
          onDragStart={this.onNameDragStart}
          onDragEnd={endDragCallback}
        />
        <CellValueComponent
          x={x}
          y={y + 0.5}
          width={width}
          height={height - 0.5}
          selected={selected}
          setSelection={setSelection}
          value={value}
          pushViewStack={pushViewStack}
          id={id}
        />
      </CellSelectionComponent>
    );
  }
}

export default SheetCellComponent;
