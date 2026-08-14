import { useEffect, useRef, useState } from 'react';
import { Button, Modal, App as AntdApp } from 'antd';
import { QrcodeOutlined } from '@ant-design/icons';

type Props = {
  onScan: (text: string) => void;
};

/** Scans a QR code via the device camera, using @zxing/browser. Hands the raw decoded text to
 *  `onScan` -- could be a WebID (a PorteJunes contact) or a `g1://`/`june://` payment URI (a
 *  non-ActivityPub Ğ1 wallet like Gecko or Ğ1nkgo); the caller decides what to do with it. */
const QrScanButton = ({ onScan }: Props) => {
  const { message } = AntdApp.useApp();
  const [open, setOpen] = useState(false);
  const videoRef = useRef<HTMLVideoElement>(null);
  const controlsRef = useRef<{ stop: () => void } | null>(null);

  useEffect(() => {
    if (!open) return;

    let cancelled = false;
    (async () => {
      const { BrowserQRCodeReader } = await import('@zxing/browser');
      const reader = new BrowserQRCodeReader();
      try {
        const controls = await reader.decodeFromVideoDevice(undefined, videoRef.current!, (result, error) => {
          if (cancelled) return;
          if (result) {
            controlsRef.current?.stop();
            setOpen(false);
            onScan(result.getText());
          }
        });
        controlsRef.current = controls;
      } catch (e: any) {
        message.error(`Impossible d'accéder à la caméra : ${e.message}`);
        setOpen(false);
      }
    })();

    return () => {
      cancelled = true;
      controlsRef.current?.stop();
    };
  }, [open]);

  return (
    <>
      <Button icon={<QrcodeOutlined />} onClick={() => setOpen(true)}>
        Scanner un QR code
      </Button>
      <Modal open={open} onCancel={() => setOpen(false)} footer={null} title="Scanner le QR code du contact">
        <video ref={videoRef} style={{ width: '100%' }} />
      </Modal>
    </>
  );
};

export default QrScanButton;
