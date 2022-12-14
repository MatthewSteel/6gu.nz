import { connect } from 'react-redux';
import DropDown from './DropDown';
import { getSheets } from '../../selectors/formulas/selectors';
import { getView } from '../../selectors/uistate/uistate';
import { copySheet, renameSheet } from '../../redux/documentEditing';


const mapStateToProps = state => ({
  selectedItemId: getView(state).sheetId,
  items: getSheets(state),
});

const mapDispatchToProps = dispatch => ({
  renameSheetProp: (id, name) => dispatch(renameSheet(id, name)),
  copySheetProp: id => dispatch(copySheet(id)),
});

class SheetMenu extends DropDown {
  static newItemName() {
    return 'New sheet';
  }

  copy(sheetId) {
    this.props.copySheetProp(sheetId);
  }

  delete(sheetId) {
    this.props.deleteSheet(sheetId);
  }

  rename(sheetId, name) {
    this.props.renameSheetProp(sheetId, name);
  }

  select(sheetId) {
    this.props.selectSheet(sheetId);
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(SheetMenu);
