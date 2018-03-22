import React, { Component } from 'react';
import classNames from 'classnames';
import './CellComponent.css';

class CellComponent extends Component {
  constructor(props) {
    super(props);
    this.state = {};
    this.onClick = this.onClick.bind(this);
  }

  onClick(ev) {
    ev.preventDefault();
    const { x, y, setSelection } = this.props;
    setSelection(y - 1, x - 1);
  }

  render() {
    const { name, value, fmt, x, y, width, height, selected } = this.props;
    const style = {
      gridColumn: `${x} / span ${width}`,
      gridRow: `${y} / span ${height}`,
    };
    const formattedValue = value ?
      (value.error || fmt(value.value)) :
      'ERR';

    return (
      <div
        className={classNames(
          'Cell',
          { selected },
        )}
        style={style}
        onClick={this.onClick}
      >
        {name && (
          <div className="Name">
            {name}
          </div>
        )}
        {name && (
          <div className="Value">
            {formattedValue}
          </div>
        )}
        {!name && (<div className="EmptyCell" />)}
      </div>
    );
  }
}

export default CellComponent;
