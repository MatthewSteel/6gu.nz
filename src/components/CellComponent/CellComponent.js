import React, { PureComponent } from 'react';
import classNames from 'classnames';
import './CellComponent.css';

const getCellContents = (value, fmt) => {
  if (!value || value.error) {
    return { error: true };
  }
  return { formattedValue: fmt(value.value) };
};

class CellComponent extends PureComponent {
  constructor(props) {
    super(props);
    this.onClick = this.onClick.bind(this);
  }

  onClick(ev) {
    ev.preventDefault();
    const { x, y, setSelection } = this.props;
    setSelection(y, x);
  }

  render() {
    const { name, value, fmt, x, y, width, height, selected } = this.props;
    const style = {
      gridColumn: `${x + 1} / span ${width}`,
      gridRow: `${y + 1} / span ${height}`,
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
            &nbsp;
            {formattedValue}
          </div>
        )}
      </div>
    );
  }
}

export default CellComponent;
