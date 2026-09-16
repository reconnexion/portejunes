import { Alert, Button, Card, Space, Typography } from 'antd';
import { RocketOutlined } from '@ant-design/icons';

import useWallet from '../hooks/useWallet';
import { APP_NAME, DUNITER_NETWORK } from '../config/env';
import g1Logo from '../assets/g1-logo.svg';

const { Title, Paragraph, Text } = Typography;

/** Shown (by PageLayout, in place of every other screen) as long as the account has no
 *  `g1:WalletSecret` on its Pod. The wallet used to be generated silently on first launch --
 *  this screen exists so that creating a hot wallet, whose secret key ends up stored on the
 *  user's Pod, is an informed, explicit decision rather than a side effect of opening the app. */
export const WalletSetupPage = () => {
  const wallet = useWallet();

  return (
    <Card style={{ width: '100%', maxWidth: 640, margin: '0 auto' }}>
      <Space direction="vertical" size="middle" style={{ width: '100%' }}>
        <Space align="center">
          <img src={g1Logo} alt="" width={40} height={40} />
          <Title level={3} style={{ margin: 0 }}>
            Bienvenue dans {APP_NAME}
          </Title>
        </Space>

        <Paragraph>
          {APP_NAME} est une application qui vous permet d'envoyer et recevoir des Ğ1 au sein du Réseau Social
          Universel. Pour cela, elle a besoin d'un portefeuille. Aucun n'est encore associé à votre porte-données : vous
          pouvez en générer un ci-dessous.
        </Paragraph>

        <div>
          <Title level={5}>Qu'est-ce qu'un « hot wallet » ?</Title>
          <Paragraph>
            Un portefeuille qui est créé directement par une application, sans avoir à saisir un mot de passe. C'est
            pratique pour des petits montants du quotidien, mais moins sûr qu'un portefeuille dont vous seul·e gardez la
            clé (Cesium, Gecko…) : ne conservez pas de grosses sommes dessus.
          </Paragraph>
        </div>

        <div>
          <Title level={5}>Où sera-t-il stocké ?</Title>
          <Paragraph>
            La clé secrète est générée ici, dans votre navigateur, puis immédiatement enregistrée dans votre
            porte-données — jamais dans le navigateur lui-même. Seule cette application, à laquelle vous avez donné
            l'accès, peut la lire. L'adresse publique du portefeuille est aussi ajoutée à votre profil, pour que vos
            contacts puissent vous payer.
          </Paragraph>
        </div>

        <Paragraph type="secondary">
          Pour en savoir plus sur la Ğ1 et la monnaie libre :{' '}
          <a href="https://monnaie-libre.fr" target="_blank" rel="noopener noreferrer">
            monnaie-libre.fr
          </a>
        </Paragraph>

        {DUNITER_NETWORK === 'g1-test' && (
          <Alert
            type="warning"
            showIcon
            message="Réseau de test"
            description="Cette instance est connectée à Ğ1-Test : les Ğ1 échangés ici n'ont aucune valeur réelle."
          />
        )}

        {wallet.creationError && (
          <Alert type="error" showIcon message="La création du portefeuille a échoué" description={wallet.creationError} />
        )}

        <Button
          type="primary"
          size="large"
          icon={<RocketOutlined />}
          loading={wallet.creating}
          onClick={() => wallet.createWallet().catch(() => {})}
          block
        >
          Générer mon portefeuille
        </Button>
        <Text type="secondary" style={{ fontSize: 12 }}>
          Vous pourrez ensuite payer, recevoir et consulter vos opérations.
        </Text>
      </Space>
    </Card>
  );
};
