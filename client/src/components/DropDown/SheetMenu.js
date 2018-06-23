import { connect } from 'react-redux';
import DropDown from './DropDown';
import { getSheets } from '../../selectors/formulas/selectors';
import { getView } from '../../selectors/uistate/uistate';
import { renameSheet } from '../../redux/documentEditing';


const mapStateToProps = state => ({
  selectedItemId: getView(state).sheetId,
  items: getSheets(state),
});

const mapDispatchToProps = dispatch => ({
  renameSheetProp: (id, name) => dispatch(renameSheet(id, name)),
});

class SheetMenu extends DropDown {
  static newItemName() {
    return 'New sheet';
  }

  /*
  copy(sheetId) {
    const { copySheet } = this.props;
    copySheet(sheetId);
    selectSheet(sheetId); ?
  }
  */

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
