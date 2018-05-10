import React, { PureComponent } from 'react';
import './DragComponents.css';


class DragOverCellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onDragOver = this.onDragOver.bind(this);
    this.onDrop = this.onDrop.bind(this);
  }

  onDragOver(ev) {
    const { dragOverCallback, y, x } = this.props;
    dragOverCallback(ev, y, x);
  }

  onDrop(ev) {
    ev.preventDefault();
    const { dropCallback, y, x } = this.props;
    dropCallback(y, x);
  }

  render() {
    const { x, y, width, height } = this.props;
    const style = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${2 * y + 1} / span ${2 * height}`,
    };
    return (
      <div
        className="DragOverCell"
        style={style}
        onDragEnter={this.onDragOver}
        onDragOver={this.onDragOver}
        onDrop={this.onDrop}
      />
    );
  }
}
export default DragOverCellComponent;
