import React, { PureComponent } from 'react';
import './CellComponent.css';

class BaseCellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
    this.maybePreventClick = this.maybePreventClick.bind(this);
  }

  maybePreventClick(ev) {
    // not draggable when the formula has focus
    // preventing default here stops the formula box from blurring when we do
    // click-to-write-formula actions.
    if (!this.props.onDragStart) ev.preventDefault();
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
        onMouseDown={this.maybePreventClick}
        onDragStart={onDragStart || undefined}
        onDragEnd={onDragEnd || undefined}
        title={title}
        draggable={!!(onDragStart && onDragEnd)}
      >
        {children}
      </div>
    );
  }
}

export default BaseCellComponent;
