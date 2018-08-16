import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import ContextMenu, { MenuItem } from './ContextMenu';
import EditableLabel from '../util/EditableLabel';
import { writeSelection } from '../../redux/documentEditing';

class CreateMenu extends PureComponent {
  constructor(props) {
    super(props);
    this.newTable = this.newThing.bind(this, '[{}]');
    this.newObject = this.newThing.bind(this, '{}');
    this.newArray = this.newThing.bind(this, '[]');
  }

  newThing(str, name) {
    const { setFormulaProp } = this.props;
    setFormulaProp(name, str);
  }

  render() {
    const { x, y } = this.props;
    return (
      <ContextMenu title="New" x={x} y={y} width={1} height={1}>
        <MenuItem>
          <div className="DropDownLabel">
            <EditableLabel
              fn={this.newTable}
              label="Table"
              extraClasses="SingleLineInput"
            />
          </div>
        </MenuItem>
        <MenuItem>
          <div className="DropDownLabel">
            <EditableLabel
              fn={this.newObject}
              label="Object"
              extraClasses="SingleLineInput"
            />
          </div>
        </MenuItem>
        <MenuItem>
          <div className="DropDownLabel">
            <EditableLabel
              fn={this.newArray}
              label="Array"
              extraClasses="SingleLineInput"
            />
          </div>
        </MenuItem>
      </ContextMenu>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  setFormulaProp: (name, str) => dispatch(writeSelection(name, str)),
});

export default connect(null, mapDispatchToProps)(CreateMenu);
