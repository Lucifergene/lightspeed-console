import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { Button, Modal, ModalVariant } from '@patternfly/react-core';

type Props = {
  handleRedirect: (event: React.MouseEvent<HTMLButtonElement>) => void;
};

const ConfirmationModal: React.FC<Props> = ({ handleRedirect }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Modal
      variant={ModalVariant.small}
      title={t('Do you want to leave this page?')}
      titleIconVariant="warning"
      className="redirect-modal"
      showClose={false}
      isOpen={true}
      aria-describedby="modal-title-icon-description"
      actions={[
        <Button id="leave" variant="primary" onClick={handleRedirect}>
          {t('Leave')}
        </Button>,
        <Button id="stay" variant="link" onClick={handleRedirect}>
          {t('Stay')}
        </Button>,
      ]}
    >
      {t('Changes you made may not be saved.')}
    </Modal>
  );
};

export default ConfirmationModal;
