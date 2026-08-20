import { useNavigate } from 'react-router';
import { Card } from 'antd';

import WalletContactPicker from '../components/WalletContactPicker';
import useOwnActor from '../hooks/useOwnActor';

/** Lists contacts who have a Ğ1 wallet (see the plan: "lister tous les contacts qui ont un
 *  wallet"). Reuses the same picker as the Payer screen -- selecting a contact here jumps
 *  straight to paying them. */
export const ContactsPage = () => {
  const navigate = useNavigate();
  const { data: ownActor } = useOwnActor();

  return (
    <Card title="Contacts" style={{ width: '100%' }}>
      <WalletContactPicker
        onSelect={recipient => navigate('/', { state: { recipient } })}
        excludeWebId={ownActor?.id}
      />
    </Card>
  );
};
