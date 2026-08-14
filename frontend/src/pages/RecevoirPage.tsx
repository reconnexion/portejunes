import { Card, Space, Typography, Spin, Statistic, Alert } from 'antd';
import { QRCodeSVG } from 'qrcode.react';

import useWallet from '../hooks/useWallet';
import useOwnActor from '../hooks/useOwnActor';
import { formatHandle } from '../utils/handle';

const { Text } = Typography;

export const RecevoirPage = () => {
  const wallet = useWallet();
  const { data: ownActor } = useOwnActor();
  const handle = ownActor ? formatHandle(ownActor) : null;

  return (
    <Space direction="vertical" size="large" align="center" style={{ width: '100%', maxWidth: 420 }}>
      <Card title="Recevoir des Ğ1" style={{ textAlign: 'center', width: '100%' }}>
        {!ownActor?.id || wallet.isLoading || !wallet.address ? (
          <Spin />
        ) : (
          <Space direction="vertical" align="center">
            {/* `g1://<address>` -- the payment URI scheme real Ğ1 wallets (Gecko, Ğ1nkgo) expect
                when scanning a QR to pay someone, confirmed against Gecko's own
                payment_uri_service.dart. Not the WebID: that's meaningful to PorteJunes'
                own contact-based flow but unparseable by any other Ğ1 wallet, which is the
                whole point of scanning a "receive" QR in the first place. */}
            <QRCodeSVG value={`g1://${wallet.address}`} size={220} />
            <Text type="secondary" copyable={{ text: wallet.address }}>
              {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
            </Text>
            {handle && (
              <Text copyable={{ text: handle }}>
                {handle}
              </Text>
            )}
          </Space>
        )}
      </Card>
      <Card style={{ width: '100%' }}>
        {wallet.error && wallet.balance === null ? (
          <Alert type="error" showIcon message="Impossible de récupérer le solde" description={wallet.error} />
        ) : (
          <Statistic
            title="Solde"
            value={wallet.balance !== null ? wallet.balance / 100 : undefined}
            precision={2}
            suffix="Ğ1"
            loading={wallet.balance === null}
          />
        )}
      </Card>
    </Space>
  );
};
