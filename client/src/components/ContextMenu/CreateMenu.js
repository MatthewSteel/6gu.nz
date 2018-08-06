import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import ContextMenu, { NameMenuItem } from './ContextMenu';
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
        <NameMenuItem contents="Table" fn={this.newTable} />
        <NameMenuItem contents="Object" fn={this.newObject} />
        <NameMenuItem contents="Array" fn={this.newArray} />
      </ContextMenu>
    );
  }
}

const mapDispatchToProps = dispatch => ({
  setFormulaProp: (sel, str) => dispatch(setFormula(sel, str)),
});

export default connect(null, mapDispatchToProps)(CreateMenu);
