import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import ContextMenu, { MenuItem } from './ContextMenu';
import { toggleForeignKey, updateForeignKey } from '../../redux/documentEditing';

class ColumnMenu extends PureComponent {
  constructor(props) {
    super(props);
    this.removeFk = this.removeFk.bind(this);
    this.toggleFk = this.toggleFk.bind(this);
    this.writeFk = this.writeFk.bind(this);
  }

  removeFk() {
    this.props.updateFk(this.props.column.id);
  }

  toggleFk() {
    this.props.toggleFk(this.props.column.id);
  }

  writeFk() {
    const { writeForeignKey, column } = this.props;
    writeForeignKey(column);
  }

  render() {
    const { x, y, column, fkHidden } = this.props;
    const options = [];
    const { foreignKey } = column;
    if (!foreignKey) {
      options.push(
        <MenuItem
          contents="Create table reference"
          fn={this.writeFk}
          key="WriteFK"
        />,
      );
    } else if (fkHidden) {
      options.push(
        <MenuItem
          contents="Unhide table reference"
          fn={this.toggleFk}
          key="ShowFk"
        />,
      );
    } else { // foreign key column is "active"
      options.push(
        <MenuItem
          contents="Edit table reference"
          fn={this.writeFk}
          key="WriteFk"
        />,
        <MenuItem
          contents="Delete table reference"
          fn={this.removeFk}
          key="RmFk"
        />,
        <MenuItem
          contents="Hide table reference"
          fn={this.toggleFk}
          key="ShowFk"
        />,
      );
    }
    return (
      <ContextMenu title={column.name} x={x} y={y} width={1} height={0.5}>
        {options}
      </ContextMenu>
    );
  }
}

const mapStateToProps = (state, ownProps) => {
  const fkHidden = state.hiddenForeignKeyColumnIds[ownProps.column.id];
  return { fkHidden };
};

const mapDispatchToProps = dispatch => ({
  updateFk: (fkId, name, pkId) => dispatch(updateForeignKey(fkId, name, pkId)),
  toggleFk: fkId => dispatch(toggleForeignKey(fkId)),
});

export default connect(mapStateToProps, mapDispatchToProps)(ColumnMenu);
