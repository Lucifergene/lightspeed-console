import * as React from 'react';
import { useTranslation } from 'react-i18next';
import { YellowExclamationTriangleIcon } from '@openshift-console/dynamic-plugin-sdk';
import { ActionGroup, Button, Text, Title } from '@patternfly/react-core';
import { TimesIcon } from '@patternfly/react-icons';

import Modal from './Modal';

type Props = {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: () => void;
};

const NewChatModal: React.FC<Props> = ({ isOpen, onClose, onConfirm }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Modal
      body={
        <>
          <Text>
            {t(
              'Are you sure you want to erase the current chat conversation and start a new chat? This action cannot be undone.',
            )}
          </Text>
          <ActionGroup>
            <Button key="confirm" onClick={onConfirm} variant="danger">
              {t('Erase and start new chat')}
            </Button>
            <Button key="cancel" onClick={onClose} variant="link">
              {t('Cancel')}
            </Button>
          </ActionGroup>
        </>
      }
      header={
        <>
          <TimesIcon className="ols-plugin__popover-close" onClick={onClose} />
          <Title headingLevel="h2">
            <YellowExclamationTriangleIcon /> {t('Confirm chat deletion')}
          </Title>
        </>
      }
      isOpen={isOpen}
      onClose={onClose}
    />
  );
};

export default NewChatModal;
