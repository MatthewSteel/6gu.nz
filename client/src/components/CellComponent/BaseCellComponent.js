import React, { PureComponent } from 'react';
import './CellComponent.css';

const preventDefault = (ev) => { ev.preventDefault(); };

class BaseCellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(ev) {
    ev.preventDefault();
    const { x, y, id, setSelection } = this.props;
    setSelection(y, x, id);
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
        onMouseDown={preventDefault}
        onDragStart={onDragStart}
        onDragEnd={onDragEnd}
        title={title}
        draggable={!!(onDragStart && onDragEnd)}
      >
        {children}
      </div>
    );
  }
}

export default BaseCellComponent;
