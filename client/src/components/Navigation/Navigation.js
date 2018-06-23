// Responsible for the URL and title bar.
// Haven't bothered with the browser forwards/back buttons yet, and
// maybe won't for a while...

import { PureComponent } from 'react';
import { connect } from 'react-redux';
import { openDocumentId, openDocumentPrettyId, openDocumentName } from '../../selectors/uistate/uistate';

const mapStateToProps = state => ({
  docId: openDocumentId(state),
  prettyId: openDocumentPrettyId(state),
  docName: openDocumentName(state),
});

class Navigation extends PureComponent {
  getUrl() {
    const { prettyId, docName, path } = this.props;
    const displayId = prettyId || 'unsaved';
    const almostDocName = docName.replace(' ', '_');
    const niceDocName = encodeURIComponent(almostDocName);
    const nicePath = encodeURIComponent(path);
    return `/d/${displayId}/${niceDocName}/${nicePath}`;
  }

  getTitle() {
    const { docName, path } = this.props;
    return `${docName}: ${path}`;
  }

  render() {
    window.history.replaceState(window.history.state, null, this.getUrl());
    document.title = this.getTitle();
    return false;
  }
}

export default connect(mapStateToProps)(Navigation);
