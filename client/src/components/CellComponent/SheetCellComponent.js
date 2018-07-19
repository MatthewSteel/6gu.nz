import React, { Fragment, PureComponent } from 'react';
import CellNameComponent from './CellNameComponent';
import CellValueComponent from './CellValueComponent';
import CellSelectionComponent from './CellSelectionComponent';
import ResizeHandleComponent from '../DragComponents/ResizeHandleComponent';

import { DRAG_MOVE } from '../../selectors/geom/dragGeom';

import './CellComponent.css';

class SheetCellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onNameDragStart = this.onNameDragStart.bind(this);
  }

  onNameDragStart(ev) {
    ev.dataTransfer.setData('text/plain', ' ');
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
      startDragCallback,
      endDragCallback,
      toggleElementSize,
    } = this.props;

    return (
      <Fragment>
        {selected && (
          <CellSelectionComponent
            x={x}
            y={y}
            width={width}
            height={height}
            selection={selected}
          />
        )}
        <ResizeHandleComponent
          y={y + height - 1}
          x={x + width - 1}
          resizeRefId={id}
          selected={!!selected}
          startDragCallback={startDragCallback}
          endDragCallback={endDragCallback}
          onClick={toggleElementSize}
        >
          <CellNameComponent
            name={name}
            x={x}
            y={y}
            width={width}
            height={0.5}
            setSelection={setSelection}
            onDragStart={this.onNameDragStart}
            onDragEnd={endDragCallback}
          />
          <CellValueComponent
            x={x}
            y={y + 0.5}
            width={width}
            height={height - 0.5}
            setSelection={setSelection}
            value={value}
            pushViewStack={pushViewStack}
            id={id}
          />
        </ResizeHandleComponent>
      </Fragment>
    );
  }
}

export default SheetCellComponent;
