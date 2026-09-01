import { useEffect, useRef, useState } from 'react';
import { useLocation, useSearchParams } from 'react-router';
import { useList } from '@refinedev/core';
import { Card, InputNumber, Input, Button, Space, Typography, App as AntdApp, Tag } from 'antd';
import { SendOutlined } from '@ant-design/icons';
import { fetchJson } from '@activitypods/refine-providers/utils';

import { authProvider } from '../providers';
import useWallet from '../hooks/useWallet';
import useOutbox from '../hooks/useOutbox';
import useOwnActor from '../hooks/useOwnActor';
import { isValidAddress } from '../hooks/useDuniter';
import { parseG1Uri } from '../utils/g1Uri';
import { parsePaytoUri } from '../utils/payto';
import WalletContactPicker from '../components/WalletContactPicker';
import QrScanButton from '../components/QrScanButton';
import type { ProfileRecord } from '../types';

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
  const [searchParams, setSearchParams] = useSearchParams();
  // Same query WalletContactPicker itself makes (identical params, so Refine/React Query dedupe
  // it rather than firing a second request) -- used below to show a contact's actual name instead
  // of their raw WebID, for a WebID that arrives as plain text: pasted, scanned, or via the
  // `?to=` deep link (see below), none of which come with a name attached the way picking someone
  // from WalletContactPicker's own list does.
  const { result: profilesResult, query: profilesQuery } = useList<ProfileRecord>({ resource: 'profile', pagination: { pageSize: 200 } });

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
      const profile = profilesResult.data.find(p => p.describes === trimmed);
      setRecipient({ kind: 'contact', webId: trimmed, name: profile?.['vcard:given-name'] || trimmed });
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

  // Deep-link handoff from another Réseau Social Universel app: `?to=<WebID|g1-address|g1://
  // URI>&amount=<Ğ1>&comment=<text>`. Since the actual spend only ever happens through this app's
  // own "Envoyer" button (see pay-activity.service.js for why), another app can't trigger a
  // payment itself -- it can only bring the user here with the recipient/amount preselected, one
  // click away. Consumed once, reusing `resolveRecipientInput`'s own validation -- deferred until
  // `profilesResult` has loaded so a WebID resolves to the contact's actual name (see above)
  // rather than briefly falling back to the raw WebID because the profile list wasn't ready yet.
  const deepLinkHandled = useRef(false);
  useEffect(() => {
    const to = searchParams.get('to');
    if (!to || deepLinkHandled.current || profilesQuery.isLoading) return;
    deepLinkHandled.current = true;
    resolveRecipientInput(to).then(() => {
      const amt = searchParams.get('amount');
      if (amt && Number.isFinite(Number(amt))) setAmount(Number(amt));
      const c = searchParams.get('comment');
      if (c) setComment(c);
    });
    setSearchParams(
      params => {
        params.delete('to');
        params.delete('amount');
        params.delete('comment');
        return params;
      },
      { replace: true }
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [profilesQuery.isLoading]);

  const maxSendable = wallet.balance !== null ? wallet.balance / 100 : null;

  const handleSend = async () => {
    if (!recipient || !amount) return;
    setSending(true);
    try {
      const amountCentimes = Math.round(amount * 100);

      // The actual Ğ1 transfer happens here, client-side, signed with this app's own wallet
      // secret -- not as a side effect of posting the `Offer` below (see pay-activity.service.js
      // for why: that used to let any app with generic outbox-post rights move real money, with
      // no payment-specific consent). By the time `outbox.post` runs, the money has already
      // moved; the activity below is purely a receipt/notification for the recipient.
      let destinationAddress: string;
      if (recipient.kind === 'address') {
        destinationAddress = recipient.address;
      } else {
        const session = authProvider.getSession();
        const { json: recipientActor } = await fetchJson(recipient.webId, {}, session?.token);
        const recipientTipjar = parsePaytoUri(recipientActor['foaf:tipjar']);
        if (!recipientTipjar) throw new Error(`${recipient.name} n'a pas encore de portefeuille Ğ1.`);
        destinationAddress = recipientTipjar.address;
      }
      await wallet.pay(destinationAddress, amountCentimes, comment || undefined);

      // A standard AS2 `Offer` wrapping a custom `g1:Payment` object, not a custom `Pay`
      // activity type -- see pay-activity.service.js for why (a brand-new top-level activity
      // type doesn't survive cross-Pod JSON-LD serialization; a custom *object* type does).
      // Best-effort: the transfer already succeeded above, so a failure here (e.g. the
      // recipient's inbox being briefly unreachable) shouldn't be reported as a payment failure.
      outbox
        .post(
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
        )
        .catch(e => console.error('Could not post the payment notification activity:', e));

      message.success('Paiement envoyé et confirmé sur la chaîne.');
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
    <Card title="Envoyer des Ğ1" style={{ width: '100%' }}>
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
  );
};
