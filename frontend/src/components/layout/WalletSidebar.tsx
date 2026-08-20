import { Card, Typography, Statistic, Alert, Spin } from 'antd';

import useWallet from '../../hooks/useWallet';

const { Text } = Typography;

export const WALLET_SIDEBAR_WIDTH = 260;

/** Balance + address, always visible in the left column on every page -- previously duplicated
 *  (or missing) on a per-page basis (Payer had its own balance card, Recevoir had a separate
 *  "Solde" card below the QR code). Pulled out into one shared place instead. */
const WalletSidebar = () => {
  const wallet = useWallet();

  return (
    <Card style={{ width: '100%' }}>
      {wallet.isLoading ? (
        <Spin />
      ) : wallet.error && wallet.balance === null ? (
        <Alert type="error" showIcon message="Solde indisponible" description={wallet.error} />
      ) : (
        <>
          <Statistic
            title="Solde"
            value={wallet.balance !== null ? wallet.balance / 100 : undefined}
            precision={2}
            suffix="Ğ1"
            loading={wallet.balance === null}
          />
          {wallet.address && (
            <Text type="secondary" copyable={{ text: wallet.address }} style={{ wordBreak: 'break-all' }}>
              {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
            </Text>
          )}
        </>
      )}
    </Card>
  );
};

export default WalletSidebar;
