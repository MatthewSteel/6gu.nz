import React, { PureComponent } from 'react';
import classNames from 'classnames';
import resizeHandle from './ResizeHandle.svg';
import './DragComponents.css';
import { DRAG_RESIZE } from '../../selectors/geom/dragGeom';


class ResizeHandleComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onResizeStart = this.onResizeStart.bind(this);
    this.onClick = this.onClick.bind(this);
  }

  onResizeStart(ev) {
    ev.dataTransfer.setData('text/plain', '.');
    const { resizeRefId, startDragCallback } = this.props;
    startDragCallback(resizeRefId, DRAG_RESIZE);
  }

  onClick(ev) {
    const { onClick, resizeRefId } = this.props;
    onClick(resizeRefId);
    ev.preventDefault();
  }

  render() {
    const { children, x, y, endDragCallback, selected } = this.props;
    const style = {
      gridColumn: `${x + 1} / span 1`,
      gridRow: `${2 * y + 1} / span 2`,
      position: 'relative',
    };
    return (
      <div className="ResizeDivHover">
        {children}
        {endDragCallback &&
          <div
            className={classNames(selected && 'ResizeThingSelected')}
            style={style}
          >
            <img
              className="ResizeHandle"
              src={resizeHandle}
              onClick={this.onClick}
              onDragStart={this.onResizeStart}
              onDragEnd={endDragCallback}
              alt="Resize cell"
              width={10}
              height={10}
            />
          </div>
        }
      </div>
    );
  }
}
export default ResizeHandleComponent;
