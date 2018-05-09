import React, { PureComponent } from 'react';
import './CellComponent.css';

class BaseCellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(ev) {
    ev.preventDefault();
    const { x, y, setSelection } = this.props;
    setSelection(y, x);
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
