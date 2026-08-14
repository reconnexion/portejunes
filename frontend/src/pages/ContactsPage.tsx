import { useNavigate } from 'react-router';

import WalletContactPicker from '../components/WalletContactPicker';

/** Lists contacts who have a Ğ1 wallet (see the plan: "lister tous les contacts qui ont un
 *  wallet"). Reuses the same picker as the Payer screen -- selecting a contact here jumps
 *  straight to paying them. */
export const ContactsPage = () => {
  const navigate = useNavigate();

  return (
    <WalletContactPicker
      onSelect={recipient => navigate('/', { state: { recipient } })}
    />
  );
};
