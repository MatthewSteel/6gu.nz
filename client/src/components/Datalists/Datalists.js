import React, { PureComponent } from 'react';
import { connect } from 'react-redux';
import { columnIndexSuggestions } from '../../selectors/formulas/codegen';

class Datalists extends PureComponent {
  render() {
    const { suggestionsData } = this.props;
    return suggestionsData.map(({ id, items }) => (
      <datalist id={id} key={id}>
        {items.map(value => <option value={value} key={value} />)}
      </datalist>
    ));
  }
}

const mapStateToProps = state => ({
  suggestionsData: columnIndexSuggestions(state),
});

export default connect(mapStateToProps)(Datalists);
