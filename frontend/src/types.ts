/** The identity shape returned by `@activitypods/refine-providers`'s `authProvider.getIdentity()`. */
export type Identity = {
  id: string;
  name: string;
  avatar?: string;
};

export type ProfileRecord = {
  id: string;
  describes?: string;
  'vcard:given-name'?: string;
  'vcard:photo'?: string;
  [key: string]: any;
};

export type WalletSecretRecord = {
  id: string;
  'g1:seed': string;
  'g1:address': string;
  [key: string]: any;
};
