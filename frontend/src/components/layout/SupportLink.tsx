import { HeartFilled } from '@ant-design/icons';

import { DONATION_URL } from '../../config/env';

/** Discreet "Soutenir cette application" link under the wallet card, like a footer -- same link as
 *  at the bottom of L'Entraide's sidebar. Styled in index.css (`.pj-support-link`), not inline,
 *  so the media query there can hide it on mobile, where the same link sits in the user menu. */
const SupportLink = () =>
  DONATION_URL ? (
    <a className="pj-support-link" href={DONATION_URL} target="_blank" rel="noopener noreferrer">
      <HeartFilled style={{ marginRight: 6 }} />
      Soutenir cette application
    </a>
  ) : null;

export default SupportLink;
