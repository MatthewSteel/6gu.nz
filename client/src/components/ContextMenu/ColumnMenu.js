import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import ContextMenu, { MenuItem } from './ContextMenu';
import { updateForeignKey } from '../../redux/documentEditing';

class ColumnMenu extends PureComponent {
  constructor(props) {
    super(props);
    this.removeFk = this.removeFk.bind(this);
    this.writeFk = this.writeFk.bind(this);
  }

  removeFk() {
    this.props.updateFk(this.props.column.id);
  }

  writeFk() {
    const { writeForeignKey, column } = this.props;
    writeForeignKey(column);
  }

  render() {
    const { x, y, column } = this.props;
    const options = [];
    const { foreignKey } = column;
    if (!foreignKey) {
      options.push(
        <MenuItem fn={this.writeFk} key="WriteFK">
          Create table reference
        </MenuItem>,
      );
    } else { // foreign key column exists
      options.push(
        <MenuItem fn={this.writeFk} key="WriteFk">
          Edit table reference
        </MenuItem>,
        <MenuItem fn={this.removeFk} key="RmFk">
          Delete table reference
        </MenuItem>,
      );
    }
    return (
      <ContextMenu title={column.name} x={x} y={y} width={1} height={0.5}>
        {options}
      </ContextMenu>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  updateFk: (fkId, name, pkId) => dispatch(updateForeignKey(fkId, name, pkId)),
});

export default connect(null, mapDispatchToProps)(ColumnMenu);
