import { connect } from 'react-redux';
import DropDown from './DropDown';
import { getSheets } from '../../selectors/formulas/selectors';
import { getViews } from '../../selectors/uistate/uistate';
import { renameSheet } from '../../redux/documentEditing';


const mapStateToProps = (state, ownProps) => {
  const { viewId } = ownProps;
  const view = getViews(state).find(({ id }) => id === viewId);
  return {
    selectedItemId: view.sheetId,
    items: getSheets(state),
  };
};

const mapDispatchToProps = dispatch => ({
  renameSheetProp: (id, name) => dispatch(renameSheet(id, name)),
});

class SheetMenu extends DropDown {
  static newItemName() {
    return 'New sheet';
  }

  /*
  copy(sheetId) {
    const { copySheet, viewId } = this.props;
    copySheet(viewId, sheetId);
  }
  */

  delete(sheetId) {
    const { deleteSheet } = this.props;
    deleteSheet(sheetId);
  }

  rename(sheetId, name) {
    const { renameSheetProp } = this.props;
    renameSheetProp(sheetId, name);
  }

  select(sheetId) {
    const { selectSheet, viewId } = this.props;
    selectSheet(viewId, sheetId);
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(SheetMenu);
