import React, { PureComponent } from 'react';
import resizeHandle from './ResizeHandle.svg';
import './DragComponents.css';
import { DRAG_RESIZE } from '../../selectors/geom/dragGeom';


class ResizeHandleComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onResizeStart = this.onResizeStart.bind(this);
  }

  onResizeStart(ev) {
    ev.dataTransfer.setData('text/plain', '.');
    const { resizeRefId, startDragCallback } = this.props;
    startDragCallback(resizeRefId, DRAG_RESIZE);
  }

  render() {
    const { x, y, resizeRefId, endDragCallback } = this.props;
    const style = {
      gridColumn: `${x + 1} / span 1`,
      gridRow: `${2 * y + 1} / span 2`,
      position: 'relative',
      display: resizeRefId ? 'block' : 'none',
    };

    return (
      <div style={style}>
        <img
          className="ResizeHandle"
          src={resizeHandle}
          onDragStart={this.onResizeStart}
          onDragEnd={endDragCallback}
          alt="Resize cell"
          width={10}
          height={10}
        />
      </div>
    );
  }
}
export default ResizeHandleComponent;
