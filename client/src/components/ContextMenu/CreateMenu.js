import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import ContextMenu, { MenuItem } from './ContextMenu';
import EditableLabel from '../util/EditableLabel';
import { unlexName } from '../../selectors/formulas/unparser';
import { setFormula } from '../../redux/documentEditing';

class CreateMenu extends PureComponent {
  constructor(props) {
    super(props);
    this.newTable = this.newThing.bind(this, '[{}]');
    this.newObject = this.newThing.bind(this, '{}');
    this.newArray = this.newThing.bind(this, '[]');
  }

  newThing(str, name) {
    const { selection, setFormulaProp } = this.props;
    const formula = `${unlexName(name)}: ${str}`;
    setFormulaProp(selection, formula);
  }

  render() {
    const { x, y } = this.props.selection;
    return (
      <ContextMenu title="New" x={x} y={y} width={1} height={1}>
        <MenuItem>
          <div className="DropDownLabel">
            <EditableLabel fn={this.newTable} label="Table" />
          </div>
        </MenuItem>
        <MenuItem>
          <div className="DropDownLabel">
            <EditableLabel fn={this.newObject} label="Object" />
          </div>
        </MenuItem>
        <MenuItem>
          <div className="DropDownLabel">
            <EditableLabel fn={this.newArray} label="Array" />
          </div>
        </MenuItem>
      </ContextMenu>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  setFormulaProp: (sel, str) => dispatch(setFormula(sel, str)),
});

export default connect(null, mapDispatchToProps)(CreateMenu);
