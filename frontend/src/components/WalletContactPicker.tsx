import { useState } from 'react';
import { useList } from '@refinedev/core';
import { List, Input, Avatar, Empty, Spin } from 'antd';
import { UserOutlined } from '@ant-design/icons';

import useTipjar from '../hooks/useTipjar';
import type { ProfileRecord } from '../types';

type Props = {
  onSelect: (recipient: { webId: string; name: string }) => void;
  /** The logged-in user's own WebID, if known -- excluded from the list so you can't pick
   *  yourself as a payment recipient. */
  excludeWebId?: string;
};

/** One contact row -- resolves its own `foaf:tipjar` and only renders if the contact actually
 *  has a wallet (most contacts won't, since PorteJunes is a young app on a young network). */
const ContactRow = ({ profile, onSelect }: { profile: ProfileRecord; onSelect: Props['onSelect'] }) => {
  const webId = profile.describes;
  const { data, isLoading } = useTipjar(webId);

  if (isLoading) return null;
  if (!data?.tipjar || !webId) return null;

  const name = profile['vcard:given-name'] || webId;

  return (
    <List.Item onClick={() => onSelect({ webId, name })} style={{ cursor: 'pointer' }}>
      <List.Item.Meta
        avatar={<Avatar src={profile['vcard:photo']} icon={<UserOutlined />} />}
        title={name}
        description={
          <>
            {data.handle && <span>{data.handle} · </span>}
            {data.tipjar.network === 'g1-test' ? 'Ğ1-Test' : 'Ğ1'}
          </>
        }
      />
    </List.Item>
  );
};

/** Lets the user pick a recipient among their contacts who already have a Ğ1 wallet (i.e. a
 *  `foaf:tipjar` on their WebID) -- see the plan: "afficher les utilisateurs qui sont liés à
 *  notre compte ... qui ont un wallet". */
const WalletContactPicker = ({ onSelect, excludeWebId }: Props) => {
  const [search, setSearch] = useState('');

  const { result, query } = useList<ProfileRecord>({
    resource: 'profile',
    pagination: { pageSize: 200 }
  });

  const filtered = (result?.data || [])
    .filter(profile => profile.describes !== excludeWebId)
    .filter(profile => (profile['vcard:given-name'] || '').toLowerCase().includes(search.toLowerCase()));

  return (
    <div>
      <Input.Search
        placeholder="Rechercher un contact"
        value={search}
        onChange={e => setSearch(e.target.value)}
        style={{ marginBottom: 12 }}
      />
      {query.isLoading ? (
        <Spin />
      ) : filtered.length === 0 ? (
        <Empty description="Aucun contact" />
      ) : (
        <List dataSource={filtered} renderItem={profile => <ContactRow profile={profile} onSelect={onSelect} />} />
      )}
    </div>
  );
};

export default WalletContactPicker;
