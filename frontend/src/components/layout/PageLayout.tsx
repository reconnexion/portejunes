import type { ReactNode } from 'react';
import { Spin } from 'antd';
import { AntdBackgroundChecks } from '@activitypods/refine-providers/antd-background-checks';

import AppBar from './AppBar';
import WalletBar from './WalletBar';
import NavMenu from './NavMenu';
import WalletSidebar from './WalletSidebar';
import { PAGE_MAX_WIDTH } from './constants';
import useOwnActor from '../../hooks/useOwnActor';
import useWallet from '../../hooks/useWallet';
import { authProvider } from '../../providers';
import { WalletSetupPage } from '../../pages/WalletSetupPage';

/** Chrome around every authenticated page, wrapped -- like L'Entraide's `AppShell` -- in
 *  `AntdBackgroundChecks`, which refuses to render the app while the backend is offline, sends
 *  the user back through the consent screen when the app's access needs changed, and checks the
 *  backend is listening to the user's inbox (the only box it reacts to: `pay-activity.service.js`
 *  handles `Offer` activities landing there via `onReceive`).
 *
 *  Layout-wise: a sticky app bar on top, and below it a left column
 *  (nav, then the wallet card -- balance + address, always visible) alongside a column for the
 *  page's own content -- every screen (Payer/Recevoir/Opérations/Contacts) renders inside the
 *  same content column.
 *
 *  Gatekeeps on the wallet too: until the account has one, every route shows WalletSetupPage
 *  instead of its own content (no nav, no wallet card -- there's nothing to navigate to or show
 *  without a wallet). Done here rather than with a redirect so the current URL survives: a
 *  `/?to=…&amount=…` deep link from another app (see PayerPage) still lands on the payment form
 *  right after the wallet is generated.
 *
 *  `sticky`, not `fixed`, for the app bar: its content is a single row (see AppBar), but staying
 *  in flow rather than removing it avoids having to hardcode/track its height here at all.
 *
 *  Column sizing/responsive switching lives in index.css (`.pj-layout` etc.), not inline styles
 *  here -- only the max width (a JS constant shared with AppBar, see constants.ts) needs to stay
 *  inline. Below the breakpoint the nav moves out of this column into a fixed bottom tab bar
 *  (see NavMenu) and the wallet card gives way to a thin strip under the app bar (see WalletBar). */
const PageLayout = ({ children }: { children: ReactNode }) => {
  const { hasWallet } = useWallet();
  const { data: ownActor } = useOwnActor();

  // `listeningTo` is empty until the actor document is loaded; the checks re-run once it is.
  const listeningTo = [ownActor?.inbox].filter((uri): uri is string => !!uri);

  return (
    <AntdBackgroundChecks authProvider={authProvider} listeningTo={listeningTo}>
      <div style={{ position: 'sticky', top: 0, zIndex: 100 }}>
        <AppBar />
        {/* Mobile only (see index.css): the wallet strip under the header, so the balance stays
            in view on every page. Same gate as the wallet card below. */}
        {hasWallet && <WalletBar />}
      </div>
      {hasWallet === null ? (
        <div style={{ display: 'flex', justifyContent: 'center', padding: 64 }}>
          <Spin size="large" />
        </div>
      ) : !hasWallet ? (
        <div className="pj-layout" style={{ maxWidth: PAGE_MAX_WIDTH, marginLeft: 'auto', marginRight: 'auto' }}>
          <WalletSetupPage />
        </div>
      ) : (
        <div className="pj-layout" style={{ maxWidth: PAGE_MAX_WIDTH, marginLeft: 'auto', marginRight: 'auto' }}>
          <div className="pj-sidebar-column">
            <NavMenu />
            <WalletSidebar />
          </div>
          <div className="pj-content-column">{children}</div>
        </div>
      )}
    </AntdBackgroundChecks>
  );
};

export default PageLayout;
