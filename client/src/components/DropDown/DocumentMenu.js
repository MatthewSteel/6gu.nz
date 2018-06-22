import { connect } from 'react-redux';
import DropDown from './DropDown';
import { dropDownDocuments } from '../../selectors/uistate/uistate';
import {
  copyDocument,
  deleteDocument,
  fetchAndLoadDocument,
  newDocument,
  renameDocument,
} from '../../redux/backend';

const mapStateToProps = (state) => {
  const docs = dropDownDocuments(state);
  return {
    selectedItemId: docs[0].id,
    items: docs,
  };
};

const mapDispatchToProps = dispatch => ({
  copyDoc: (docs, docId) => copyDocument(dispatch, docs, docId),
  deleteDoc: docId => dispatch(deleteDocument(docId)),
  renameDoc: (docId, name) => dispatch(renameDocument(docId, name)),
  loadDoc: docId => fetchAndLoadDocument(dispatch, docId),
  newDoc: () => dispatch(newDocument()),
});

class DocumentMenu extends DropDown {
  static newItemName() {
    return 'New document';
  }

  copy(docId) {
    const { copyDoc, items } = this.props;
    copyDoc(items, docId);
  }

  delete(docId) {
    this.props.deleteDoc(docId);
  }

  rename(docId, name) {
    this.props.renameDoc(docId, name);
  }

  select(docId) {
    if (docId === 'new') {
      this.props.newDoc();
    } else {
      this.props.loadDoc(docId);
    }
  }

  static itemName(doc) {
    return doc.metadata.name;
  }
  static itemIsUnsaved(doc) {
    return !doc.prettyId;
  }
}

export default connect(mapStateToProps, mapDispatchToProps)(DocumentMenu);
