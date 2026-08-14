import { useState } from 'react';
import { useLocation } from 'react-router';
import { Card, InputNumber, Input, Button, Space, Typography, App as AntdApp, Statistic, Alert, Tag } from 'antd';
import { SendOutlined } from '@ant-design/icons';

import useWallet from '../hooks/useWallet';
import useOutbox from '../hooks/useOutbox';
import useOwnActor from '../hooks/useOwnActor';
import { isValidAddress } from '../hooks/useDuniter';
import { parseG1Uri } from '../utils/g1Uri';
import WalletContactPicker from '../components/WalletContactPicker';
import QrScanButton from '../components/QrScanButton';

const { Text } = Typography;

/** Who a payment goes to -- see the plan/session notes: PorteJunes pays both ActivityPub
 *  contacts (a WebID, delivered + notified via the `Offer` activity's `to`) and people with a
 *  plain Ğ1 wallet and no ActivityPub presence at all (Gecko, Cesium users), reached by
 *  embedding their raw address in the activity's `object` instead -- there's no inbox to
 *  deliver to, so no `to`/`target`, and no receive-side notification either. */
type Recipient = { kind: 'contact'; webId: string; name: string } | { kind: 'address'; address: string };

export const PayerPage = () => {
  const { message } = AntdApp.useApp();
  const wallet = useWallet();
  const outbox = useOutbox();
  const { data: ownActor } = useOwnActor();
  const location = useLocation();

  // Set when navigating here from ContactsPage after picking a recipient there.
  const preselected = (location.state as { recipient?: { webId: string; name: string } } | null)?.recipient;
  const [recipient, setRecipient] = useState<Recipient | null>(
    preselected ? { kind: 'contact', webId: preselected.webId, name: preselected.name } : null
  );
  const [amount, setAmount] = useState<number | null>(null);
  const [comment, setComment] = useState('');
  const [sending, setSending] = useState(false);

  // Accepts a WebID (a PorteJunes/ActivityPub contact), a Gecko/Ğ1nkgo `g1://`/`june://`
  // payment URI, or a bare Ğ1 address -- anything else is rejected up front rather than
  // posting an activity that can only ever fail once the backend tries to resolve it (silently,
  // since there's no notifications UI yet to surface that failure). Also rejects paying
  // yourself, by WebID or by address (own address isn't known until the wallet's loaded, so
  // that half of the check is skipped while it's still loading rather than blocking input).
  const resolveRecipientInput = async (value: string) => {
    const trimmed = value.trim();

    if (/^https?:\/\//i.test(trimmed)) {
      if (trimmed === ownActor?.id) {
        message.error('Vous ne pouvez pas vous payer vous-même.');
        return;
      }
      setRecipient({ kind: 'contact', webId: trimmed, name: trimmed });
      return;
    }

    const g1Uri = parseG1Uri(trimmed);
    if (g1Uri) {
      if (!(await isValidAddress(g1Uri.address))) {
        message.error("Cette adresse Ğ1 n'est pas valide.");
        return;
      }
      if (wallet.address && g1Uri.address === wallet.address) {
        message.error('Vous ne pouvez pas vous payer vous-même.');
        return;
      }
      setRecipient({ kind: 'address', address: g1Uri.address });
      if (g1Uri.amount) setAmount(g1Uri.amount);
      if (g1Uri.comment) setComment(g1Uri.comment);
      return;
    }

    message.error("Ce code ne correspond ni à un contact PorteJunes (WebID) ni à une adresse Ğ1 valide.");
  };

  const maxSendable = wallet.balance !== null ? wallet.balance / 100 : null;

  const handleSend = async () => {
    if (!recipient || !amount) return;
    setSending(true);
    try {
      const amountCentimes = Math.round(amount * 100);
      // A standard AS2 `Offer` wrapping a custom `g1:Payment` object, not a custom `Pay`
      // activity type -- see pay-activity.service.js for why (a brand-new top-level activity
      // type doesn't survive cross-Pod JSON-LD serialization; a custom *object* type does).
      await outbox.post(
        recipient.kind === 'contact'
          ? {
              type: 'Offer',
              actor: outbox.owner,
              object: { type: 'g1:Payment', 'g1:amount': amountCentimes, 'as:summary': comment || undefined },
              target: recipient.webId,
              to: recipient.webId
            }
          : {
              type: 'Offer',
              actor: outbox.owner,
              object: {
                type: 'g1:Payment',
                'g1:amount': amountCentimes,
                'as:summary': comment || undefined,
                'g1:address': recipient.address
              }
              // No target/to: nobody to deliver to -- the recipient has no ActivityPub inbox.
            }
      );
      message.success('Paiement envoyé — vous recevrez une notification une fois le virement confirmé.');
      setRecipient(null);
      setAmount(null);
      setComment('');
    } catch (e: any) {
      message.error(e.message);
    } finally {
      setSending(false);
    }
  };

  return (
    <Space direction="vertical" size="large" style={{ width: '100%', maxWidth: 480 }}>
      <Card>
        {wallet.error && wallet.balance === null ? (
          <Alert type="error" showIcon message="Impossible de récupérer le solde" description={wallet.error} />
        ) : (
          <Statistic
            title="Portefeuille Ğ1"
            value={wallet.balance !== null ? wallet.balance / 100 : undefined}
            precision={2}
            suffix="Ğ1"
            loading={wallet.isLoading || wallet.balance === null}
          />
        )}
        {wallet.address && (
          <Text type="secondary" copyable={{ text: wallet.address }}>
            {wallet.address.slice(0, 8)}…{wallet.address.slice(-6)}
          </Text>
        )}
      </Card>

      <Card title="Envoyer des Ğ1">
        {!recipient ? (
          <Space direction="vertical" style={{ width: '100%' }}>
            <QrScanButton onScan={resolveRecipientInput} />
            <Input.Search
              placeholder="Coller un WebID ou une adresse Ğ1"
              enterButton="OK"
              onSearch={value => value && resolveRecipientInput(value)}
            />
            <WalletContactPicker onSelect={r => setRecipient({ kind: 'contact', ...r })} excludeWebId={ownActor?.id} />
          </Space>
        ) : (
          <Space direction="vertical" style={{ width: '100%' }}>
            <Text>
              Destinataire :{' '}
              {recipient.kind === 'contact' ? (
                <strong>{recipient.name}</strong>
              ) : (
                <>
                  <Tag>Ğ1</Tag>
                  <strong>
                    {recipient.address.slice(0, 8)}…{recipient.address.slice(-6)}
                  </strong>
                </>
              )}{' '}
              <a onClick={() => setRecipient(null)}>changer</a>
            </Text>
            {recipient.kind === 'address' && (
              <Text type="secondary">
                Portefeuille externe (hors Réseau Social Universel) : pas de notification, juste un virement.
              </Text>
            )}
            <InputNumber
              addonAfter="Ğ1"
              min={0}
              max={maxSendable ?? undefined}
              step={0.01}
              value={amount}
              onChange={setAmount}
              style={{ width: '100%' }}
              placeholder="Montant"
              status={amount !== null && maxSendable !== null && amount > maxSendable ? 'error' : undefined}
            />
            {amount !== null && maxSendable !== null && amount > maxSendable && (
              <Text type="danger">Solde insuffisant ({maxSendable.toFixed(2)} Ğ1 disponible)</Text>
            )}
            <Input
              placeholder="Commentaire (optionnel)"
              value={comment}
              onChange={e => setComment(e.target.value)}
              maxLength={256}
              showCount
            />
            <Button
              type="primary"
              icon={<SendOutlined />}
              onClick={handleSend}
              loading={sending}
              disabled={!amount || amount <= 0 || maxSendable === null || amount > maxSendable}
              block
            >
              Envoyer
            </Button>
          </Space>
        )}
      </Card>
    </Space>
  );
};
