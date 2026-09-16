import { Spin, Typography } from 'antd';

import useWallet from '../../hooks/useWallet';
import { PAGE_MAX_WIDTH } from './constants';

const { Text } = Typography;

/** Mobile-only counterpart of WalletSidebar: a thin strip pinned right below the app bar (both
 *  live in PageLayout's sticky wrapper, so it stays visible on every page while scrolling) with
 *  the balance on the left and the truncated public key on the right. Below the breakpoint the
 *  wallet card would otherwise sit at the top of the single stacked column, taking a big chunk of
 *  the viewport before the page's own content -- see `.pj-wallet-bar` / `.pj-wallet-card` in
 *  index.css for the display switch between the two. */
const WalletBar = () => {
  const wallet = useWallet();

  return (
    <div className="pj-wallet-bar">
      <div
        style={{
          maxWidth: PAGE_MAX_WIDTH,
          width: '100%',
          margin: '0 auto',
          padding: '0 16px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: 12
        }}
      >
        {wallet.isLoading || (wallet.balance === null && !wallet.error) ? (
          <Spin size="small" />
        ) : wallet.error && wallet.balance === null ? (
          <Text type="danger" style={{ fontSize: 13 }}>
            Solde indisponible
          </Text>
        ) : (
          <Text strong style={{ fontSize: 16, whiteSpace: 'nowrap' }}>
            {(wallet.balance! / 100).toFixed(2)} Ğ1
          </Text>
        )}
        {wallet.address && (
          <Text type="secondary" copyable={{ text: wallet.address }} style={{ fontSize: 13, whiteSpace: 'nowrap' }}>
            {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
          </Text>
        )}
      </div>
    </div>
  );
};

export default WalletBar;
