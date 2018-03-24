import React, { Component } from 'react';
import classNames from 'classnames';
import './CellComponent.css';

const getCellContents = (value, fmt) => {
  if (!value) {
    return { formattedValue: 'Err: \u21BB', error: true };
  }
  if (value.error) {
    return { formattedValue: `Err: ${value.error}`, error: true };
  }
  return { formattedValue: fmt(value.value), error: false };
};

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
    const { error, formattedValue } = getCellContents(value, fmt);

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
          <div
            className={classNames(
              'Value',
              { CellError: error },
            )}
          >
            {formattedValue}
          </div>
        )}
        {!name && (<div className="EmptyCell" />)}
      </div>
    );
  }
}

export default CellComponent;
