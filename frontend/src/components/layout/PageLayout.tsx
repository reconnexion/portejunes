import type { ReactNode } from 'react';

import AppBar from './AppBar';
import NavMenu from './NavMenu';
import WalletSidebar from './WalletSidebar';
import { PAGE_MAX_WIDTH } from './constants';

/** Chrome around every authenticated page: a sticky app bar on top, and below it a left column
 *  (nav, then the wallet card -- balance + address, always visible) alongside a column for the
 *  page's own content -- every screen (Payer/Recevoir/Opérations/Contacts) renders inside the
 *  same content column.
 *
 *  `sticky`, not `fixed`, for the app bar: its content is a single row (see AppBar), but staying
 *  in flow rather than removing it avoids having to hardcode/track its height here at all.
 *
 *  Column sizing/responsive switching lives in index.css (`.pj-layout` etc.), not inline styles
 *  here -- only the max width (a JS constant shared with AppBar, see constants.ts) needs to stay
 *  inline. Below the breakpoint the nav moves out of this column into a fixed bottom tab bar
 *  (see NavMenu), so the wallet card ends up first and full width, matching every other card. */
const PageLayout = ({ children }: { children: ReactNode }) => (
  <>
    <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
      <AppBar />
    </div>
    <div className="pj-layout" style={{ maxWidth: PAGE_MAX_WIDTH, marginLeft: 'auto', marginRight: 'auto' }}>
      <div className="pj-sidebar-column">
        <NavMenu />
        <WalletSidebar />
      </div>
      <div className="pj-content-column">{children}</div>
    </div>
  </>
);

export default PageLayout;
