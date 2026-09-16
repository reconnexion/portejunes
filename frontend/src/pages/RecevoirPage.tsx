import { Card, Space, Typography, Spin } from 'antd';
import { QrcodeOutlined } from '@ant-design/icons';
import { QRCodeSVG } from 'qrcode.react';

import useWallet from '../hooks/useWallet';
import useOwnActor from '../hooks/useOwnActor';
import CardTitle from '../components/CardTitle';

const { Text } = Typography;

// Balance now lives in the always-visible WalletSidebar (see PageLayout) -- this page only
// needs the QR code and address, which are specific to "receiving", not duplicated there.
export const RecevoirPage = () => {
  const wallet = useWallet();
  const { data: ownActor } = useOwnActor();

  return (
    <Card title={<CardTitle icon={<QrcodeOutlined />}>Recevoir des Ğ1</CardTitle>} style={{ width: '100%' }} styles={{ body: { textAlign: 'center' } }}>
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
        </Space>
      )}
    </Card>
  );
};
