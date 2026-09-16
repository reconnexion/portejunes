import { useQuery } from '@tanstack/react-query';
import { List, Empty, Spin, Alert, Card, Typography } from 'antd';
import { ArrowUpOutlined, ArrowDownOutlined, HistoryOutlined } from '@ant-design/icons';

import useWallet from '../hooks/useWallet';
import useContactDirectory from '../hooks/useContactDirectory';
import { getHistory } from '../hooks/useDuniter';
import CardTitle from '../components/CardTitle';

const { Text } = Typography;

/** Best label for the other side of a transfer: a real Duniter/Cesium identity (Web-of-Trust
 *  member username) when it has one, else a known PorteJunes contact's handle/name (for other
 *  hot wallets, which never have a linked identity -- see the plan), else the raw address. */
const counterpartyLabel = (
  address: string,
  identity: string | null | undefined,
  directory: ReturnType<typeof useContactDirectory>
) => {
  if (identity) return identity;
  const contact = directory.getContact(address);
  if (contact) return contact.handle || contact.name;
  return `${address.slice(0, 8)}…${address.slice(-6)}`;
};

export const TransactionsPage = () => {
  const wallet = useWallet();
  const directory = useContactDirectory();

  const { data: history, isLoading } = useQuery({
    queryKey: ['history', wallet.address],
    queryFn: () => getHistory(wallet.address!),
    enabled: !!wallet.address,
    refetchInterval: 30_000
  });

  const title = <CardTitle icon={<HistoryOutlined />}>Opérations</CardTitle>;

  if (wallet.isLoading || isLoading || directory.isLoading) {
    return (
      <Card title={title} style={{ width: '100%' }} styles={{ body: { textAlign: 'center' } }}>
        <Spin />
      </Card>
    );
  }

  // getHistory() never throws (returns [] on any failure) -- an empty list here is
  // indistinguishable from "the indexer is unreachable", see the plan's open risk on this.
  if (!history || history.length === 0) {
    return (
      <Card title={title} style={{ width: '100%' }}>
        <Alert
          type="info"
          showIcon
          message="Historique indisponible ou vide"
          description="Si vous avez déjà envoyé ou reçu des Ğ1, l'indexeur communautaire est peut-être temporairement inaccessible."
          style={{ marginBottom: 16 }}
        />
        <Empty description="Aucune opération" />
      </Card>
    );
  }

  return (
    <Card title={title} style={{ width: '100%' }} styles={{ body: { padding: 0 } }}>
      <List
        dataSource={history}
        style={{ padding: '0 24px' }}
        renderItem={tx => {
          const received = tx.toId === wallet.address;
          const counterpartyAddress = received ? tx.fromId : tx.toId;
          const counterpartyIdentity = received ? tx.fromIdentity : tx.toIdentity;
          const label = counterpartyLabel(counterpartyAddress, counterpartyIdentity, directory);
          return (
            <List.Item>
              <List.Item.Meta
                avatar={received ? <ArrowDownOutlined style={{ color: 'green' }} /> : <ArrowUpOutlined style={{ color: 'red' }} />}
                title={`${received ? '+' : '-'}${(tx.amount / 100).toFixed(2)} Ğ1 ${received ? 'de' : 'à'} ${label}`}
                description={
                  <>
                    <Text type="secondary">{new Date(tx.timestamp).toLocaleString()}</Text>
                    {tx.comment && (
                      <div>
                        <Text italic>« {tx.comment} »</Text>
                      </div>
                    )}
                  </>
                }
              />
            </List.Item>
          );
        }}
      />
    </Card>
  );
};
