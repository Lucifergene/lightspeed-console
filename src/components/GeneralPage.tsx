import { List as ImmutableList } from 'immutable';
import { dump } from 'js-yaml';
import { cloneDeep, defer, each, isMatch, omit } from 'lodash';
import * as React from 'react';
import { useTranslation } from 'react-i18next';
import Markdown from 'react-markdown';
import { useDispatch, useSelector } from 'react-redux';
import {
  consoleFetchJSON,
  K8sResourceKind,
  useK8sWatchResource,
} from '@openshift-console/dynamic-plugin-sdk';
import {
  Alert,
  Badge,
  Button,
  Chip,
  ChipGroup,
  CodeBlock,
  CodeBlockAction,
  CodeBlockCode,
  ExpandableSection,
  Form,
  HelperText,
  HelperTextItem,
  Icon,
  Label,
  Level,
  LevelItem,
  MenuToggle,
  MenuToggleElement,
  Page,
  PageSection,
  Select,
  SelectList,
  SelectOption,
  Spinner,
  Split,
  SplitItem,
  TextArea,
  Title,
  Tooltip,
} from '@patternfly/react-core';
import {
  CompressIcon,
  ExpandIcon,
  ExternalLinkAltIcon,
  FileCodeIcon,
  PaperPlaneIcon,
  PencilAltIcon,
  PlusCircleIcon,
  TaskIcon,
  WindowMinimizeIcon,
} from '@patternfly/react-icons';

import { AttachmentTypes, isAttachmentChanged, toOLSAttachment } from '../attachments';
import { getFetchErrorMessage } from '../error';
import { AuthStatus, getRequestInitWithAuthHeader, useAuth } from '../hooks/useAuth';
import { useBoolean } from '../hooks/useBoolean';
import { useLocationContext } from '../hooks/useLocationContext';
import {
  attachmentDelete,
  attachmentsClear,
  attachmentSet,
  chatHistoryClear,
  chatHistoryPush,
  openAttachmentSet,
  setContext,
  setConversationID,
  setQuery,
} from '../redux-actions';
import { State } from '../redux-reducers';
import { Attachment, ChatEntry, ReferencedDoc } from '../types';
import AttachEventsModal from './AttachEventsModal';
import AttachLogModal from './AttachLogModal';
import AttachmentModal from './AttachmentModal';
import CopyAction from './CopyAction';
import ImportAction from './ImportAction';
import Feedback from './Feedback';
import NewChatModal from './NewChatModal';
import ReadinessAlert from './ReadinessAlert';
import ResourceIcon from './ResourceIcon';

import './general-page.css';

const QUERY_ENDPOINT = '/api/proxy/plugin/lightspeed-console-plugin/ols/v1/query';
const ALERTS_ENDPOINT = '/api/prometheus/api/v1/rules?type=alert';

const REQUEST_TIMEOUT = 10 * 60 * 1000; // 10 minutes

type QueryResponse = {
  conversation_id: string;
  query: string;
  referenced_documents: Array<ReferencedDoc>;
  response: string;
  truncated: boolean;
};

type ExternalLinkProps = {
  children: React.ReactNode;
  href: string;
};

const ExternalLink: React.FC<ExternalLinkProps> = ({ children, href }) => (
  <a href={href} rel="noopener noreferrer" target="_blank">
    {children} <ExternalLinkAltIcon />
  </a>
);

type DocLinkProps = {
  reference: ReferencedDoc;
};

const DocLink: React.FC<DocLinkProps> = ({ reference }) => {
  if (!reference || typeof reference.docs_url !== 'string' || typeof reference.title !== 'string') {
    return null;
  }

  return (
    <Chip isReadOnly textMaxWidth="16rem">
      <ExternalLink href={reference.docs_url}>{reference.title}</ExternalLink>
    </Chip>
  );
};

const Code = ({ children }: { children: React.ReactNode }) => {
  if (!String(children).includes('\n')) {
    return <code>{children}</code>;
  }

  return (
    <CodeBlock
      actions={
        <CodeBlockAction>
          <CopyAction value={children.toString()} />
          <ImportAction value={children.toString()} />
        </CodeBlockAction>
      }
    >
      <CodeBlockCode className="ols-plugin__code-block">{children}</CodeBlockCode>
    </CodeBlock>
  );
};

type AttachmentLabelProps = {
  attachment: Attachment;
  isEditable?: boolean;
  onClose?: () => void;
};

const AttachmentLabel: React.FC<AttachmentLabelProps> = ({ attachment, isEditable, onClose }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const onClick = React.useCallback(() => {
    dispatch(openAttachmentSet(Object.assign({}, attachment, { isEditable })));
  }, [attachment, isEditable, dispatch]);

  if (!attachment) {
    return null;
  }

  const { attachmentType, kind, name } = attachment;
  const isChanged = isAttachmentChanged(attachment);

  return (
    <Tooltip content={isChanged ? t('Preview attachment - modified') : t('Preview attachment')}>
      <Label className="ols-plugin__context-label" onClick={onClick} onClose={onClose}>
        <ResourceIcon kind={kind} />
        <span className="ols-plugin__context-label-text">{name}</span>
        {isChanged && (
          <span className="ols-plugin__inline-icon">
            <PencilAltIcon />
          </span>
        )}
        {kind !== 'Alert' && <Label className="ols-plugin__inline-icon">{attachmentType}</Label>}
      </Label>
    </Tooltip>
  );
};

type ChatHistoryEntryProps = {
  conversationID: string;
  entry: ChatEntry;
  entryIndex: number;
  scrollIntoView: () => void;
};

const ChatHistoryEntry: React.FC<ChatHistoryEntryProps> = ({
  conversationID,
  entry,
  entryIndex,
  scrollIntoView,
}) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const [isContextExpanded, toggleContextExpanded] = useBoolean(false);
  const isUserFeedbackEnabled = useSelector((s: State) =>
    s.plugins?.ols?.get('isUserFeedbackEnabled'),
  );

  if (entry.who === 'ai') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
        <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
        {entry.error ? (
          <Alert
            isExpandable={!!entry.error.moreInfo}
            isInline
            title={
              entry.error.moreInfo
                ? entry.error.message
                : t('Error querying OpenShift Lightspeed service')
            }
            variant="danger"
          >
            {entry.error.moreInfo ? entry.error.moreInfo : entry.error.message}
          </Alert>
        ) : (
          <>
            <Markdown components={{ code: Code }}>{entry.text}</Markdown>
            {entry.isTruncated && (
              <Alert isInline title={t('History truncated')} variant="warning">
                {t('Conversation history has been truncated to fit within context window.')}
              </Alert>
            )}
            {entry.references && (
              <ChipGroup categoryName="Related documentation" className="ols-plugin__references">
                {entry.references.map((r, i) => (
                  <DocLink key={i} reference={r} />
                ))}
              </ChipGroup>
            )}
            {isUserFeedbackEnabled && (
              <Feedback
                conversationID={conversationID}
                entryIndex={entryIndex}
                scrollIntoView={scrollIntoView}
              />
            )}
          </>
        )}
      </div>
    );
  }
  if (entry.who === 'user') {
    return (
      <div className="ols-plugin__chat-entry ols-plugin__chat-entry--user">
        <div className="ols-plugin__chat-entry-name">You</div>
        <div className="ols-plugin__chat-entry-text">{entry.text}</div>
        {entry.attachments && Object.keys(entry.attachments).length > 0 && (
          <ExpandableSection
            className="ols-plugin__chat-history-context"
            isExpanded={isContextExpanded}
            onToggle={toggleContextExpanded}
            toggleContent={
              <>
                Context
                <Badge className="ols-plugin__chat-history-context-count">
                  {Object.keys(entry.attachments).length}
                </Badge>
              </>
            }
          >
            {Object.keys(entry.attachments).map((key: string) => {
              const attachment: Attachment = entry.attachments[key];
              return <AttachmentLabel attachment={attachment} key={key} />;
            })}
          </ExpandableSection>
        )}
      </div>
    );
  }
  return null;
};

const ChatHistoryEntryWaiting = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <div className="ols-plugin__chat-entry ols-plugin__chat-entry--ai">
      <div className="ols-plugin__chat-entry-name">OpenShift Lightspeed</div>
      <HelperText>
        <HelperTextItem variant="indeterminate">
          {t('Waiting for LLM provider...')} <Spinner size="lg" />
        </HelperTextItem>
      </HelperText>
    </div>
  );
};

type AuthAlertProps = {
  authStatus: AuthStatus;
};

const AuthAlert: React.FC<AuthAlertProps> = ({ authStatus }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  if (authStatus === AuthStatus.NotAuthenticated) {
    return (
      <Alert className="ols-plugin__alert" isInline title={t('Not authenticated')} variant="danger">
        {t(
          'OpenShift Lightspeed authentication failed. Contact your system administrator for more information.',
        )}
      </Alert>
    );
  }

  if (authStatus === AuthStatus.NotAuthorized) {
    return (
      <Alert className="ols-plugin__alert" isInline title={t('Not authorized')} variant="danger">
        {t(
          'You do not have sufficient permissions to access OpenShift Lightspeed. Contact your system administrator for more information.',
        )}
      </Alert>
    );
  }

  return null;
};

const PrivacyAlert: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <Alert className="ols-plugin__alert" isInline title={t('Important')} variant="info">
      {t(
        'OpenShift Lightspeed can answer questions related to OpenShift. Do not include personal or business sensitive information in your input. Interactions with OpenShift Lightspeed may be reviewed and used to improve our products and services.',
      )}
    </Alert>
  );
};

const Welcome: React.FC = () => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  return (
    <>
      <div className="ols-plugin__welcome-logo"></div>
      <Title className="pf-v5-u-text-align-center" headingLevel="h1">
        {t('Red Hat OpenShift Lightspeed')}
      </Title>
      <Title className="ols-plugin__welcome-subheading pf-v5-u-text-align-center" headingLevel="h4">
        {t(
          'Explore deeper insights, engage in meaningful discussions, and unlock new possibilities with Red Hat OpenShift Lightspeed. Answers are provided by generative AI technology, please use appropriate caution when following recommendations.',
        )}
      </Title>
    </>
  );
};

type AttachMenuProps = {
  context: K8sResourceKind;
};

const AttachMenu: React.FC<AttachMenuProps> = ({ context }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const events = useSelector((s: State) => s.plugins?.ols?.get('contextEvents'));
  const isEventsLoading = useSelector((s: State) => s.plugins?.ols?.get('isContextEventsLoading'));

  const [error, setError] = React.useState<string>();
  const [isEventsModalOpen, , openEventsModal, closeEventsModal] = useBoolean(false);
  const [isLogModalOpen, , openLogModal, closeLogModal] = useBoolean(false);
  const [isLoading, , setLoading, setLoaded] = useBoolean(false);
  const [isOpen, toggleIsOpen, , close, setIsOpen] = useBoolean(false);

  const kind = context?.kind;
  const name = context?.metadata?.name;
  const namespace = context?.metadata?.namespace;

  const onSelect = React.useCallback(
    (_e: React.MouseEvent | undefined, attachmentType: string) => {
      if (!kind || !name) {
        setError(t('Could not get context'));
        return;
      }

      if (attachmentType === AttachmentTypes.Events) {
        openEventsModal();
        close();
      } else if (attachmentType === AttachmentTypes.Log) {
        openLogModal();
        close();
      } else if (kind === 'Alert') {
        setLoading();
        const labels = Object.fromEntries(new URLSearchParams(location.search));
        consoleFetchJSON(ALERTS_ENDPOINT, 'get', getRequestInitWithAuthHeader(), REQUEST_TIMEOUT)
          .then((response) => {
            let alert;
            each(response?.data?.groups, (group) => {
              each(group.rules, (rule) => {
                alert = rule.alerts?.find((a) => isMatch(labels, a.labels));
                if (alert) {
                  return false;
                }
              });
              if (alert) {
                return false;
              }
            });
            if (alert) {
              try {
                const yaml = dump(alert, { lineWidth: -1 }).trim();
                dispatch(
                  attachmentSet(AttachmentTypes.YAML, kind, name, undefined, namespace, yaml),
                );
                close();
              } catch (e) {
                setError(t('Error converting to YAML: {{e}}', { e }));
              }
            } else {
              setError(t('Failed to find definition YAML for alert'));
            }
            setLoaded();
          })
          .catch((err) => {
            setError(t('Error fetching alerting rules: {{err}}', { err }));
            setLoaded();
          });
      } else if (
        attachmentType === AttachmentTypes.YAML ||
        attachmentType === AttachmentTypes.YAMLStatus
      ) {
        const data = cloneDeep(
          attachmentType === AttachmentTypes.YAMLStatus
            ? { kind: context.kind, metadata: context.metadata, status: context.status }
            : context,
        );
        // We ignore the managedFields section because it doesn't have much value
        delete data.metadata.managedFields;
        try {
          const yaml = dump(data, { lineWidth: -1 }).trim();
          dispatch(attachmentSet(attachmentType, kind, name, undefined, namespace, yaml));
          close();
        } catch (e) {
          setError(t('Error converting to YAML: {{e}}', { e }));
        }
      }
    },
    [
      close,
      context,
      dispatch,
      kind,
      name,
      namespace,
      openEventsModal,
      openLogModal,
      setLoaded,
      setLoading,
      t,
    ],
  );

  const toggle = React.useCallback(
    (toggleRef: React.Ref<MenuToggleElement>) => (
      <Tooltip content={t('Attach context')} style={isOpen ? { visibility: 'hidden' } : undefined}>
        <MenuToggle
          className="ols-plugin__attach-menu"
          isExpanded={isOpen}
          onClick={toggleIsOpen}
          ref={toggleRef}
          variant="plain"
        >
          <Icon size="md">
            <PlusCircleIcon
              className={isOpen ? 'ols-plugin__context-menu-icon--active' : undefined}
            />
          </Icon>
        </MenuToggle>
      </Tooltip>
    ),
    [isOpen, t, toggleIsOpen],
  );

  const showEvents = [
    'CronJob',
    'DaemonSet',
    'Deployment',
    'Job',
    'Pod',
    'ReplicaSet',
    'StatefulSet',
  ].includes(kind);

  const showLogs = ['DaemonSet', 'Deployment', 'Job', 'Pod', 'ReplicaSet', 'StatefulSet'].includes(
    kind,
  );

  return (
    <>
      {showEvents && context && context.metadata?.uid && (
        <AttachEventsModal
          isOpen={isEventsModalOpen}
          kind={kind}
          name={name}
          namespace={namespace}
          onClose={closeEventsModal}
          uid={context.metadata?.uid}
        />
      )}
      {showLogs && context && (
        <AttachLogModal isOpen={isLogModalOpen} onClose={closeLogModal} resource={context} />
      )}

      <Select isOpen={isOpen} onOpenChange={setIsOpen} onSelect={onSelect} toggle={toggle}>
        <SelectList className="ols-plugin__context-menu">
          {!kind || !name ? (
            <Alert isInline isPlain title="No context found" variant="info">
              <p>The current page your are viewing does not contain any supported context.</p>
            </Alert>
          ) : (
            <>
              <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
                {t('Currently viewing')}
              </Title>
              <Label
                className="ols-plugin__context-label"
                textMaxWidth="10rem"
                title={t('{{kind}} {{name}} in namespace {{namespace}}', { kind, name, namespace })}
              >
                <ResourceIcon kind={kind} /> {name}
              </Label>

              <Title className="ols-plugin__context-menu-heading" headingLevel="h5">
                {t('Attach')}
              </Title>

              {kind === 'Alert' ? (
                <SelectOption value={AttachmentTypes.YAML}>
                  <FileCodeIcon /> {t('Alert')} {isLoading && <Spinner size="md" />}
                </SelectOption>
              ) : (
                <>
                  <SelectOption value={AttachmentTypes.YAML}>
                    <FileCodeIcon /> YAML
                  </SelectOption>
                  <SelectOption value={AttachmentTypes.YAMLStatus}>
                    <FileCodeIcon /> YAML <Chip isReadOnly>status</Chip> {t('only')}
                  </SelectOption>
                  {showEvents && (
                    <div
                      title={!isEventsLoading && events.length === 0 ? t('No events') : undefined}
                    >
                      <SelectOption
                        isDisabled={!isEventsLoading && events.length === 0}
                        value={AttachmentTypes.Events}
                      >
                        <TaskIcon /> {t('Events')}
                      </SelectOption>
                    </div>
                  )}
                  {showLogs && (
                    <SelectOption value={AttachmentTypes.Log}>
                      <TaskIcon /> {t('Logs')}
                    </SelectOption>
                  )}
                </>
              )}
            </>
          )}

          {error && (
            <Alert
              className="ols-plugin__alert"
              isInline
              title={t('Failed to attach context')}
              variant="danger"
            >
              {error}
            </Alert>
          )}
        </SelectList>
      </Select>
    </>
  );
};

type GeneralPageProps = {
  onClose: () => void;
  onCollapse?: () => void;
  onExpand?: () => void;
};

const GeneralPage: React.FC<GeneralPageProps> = ({ onClose, onCollapse, onExpand }) => {
  const { t } = useTranslation('plugin__lightspeed-console-plugin');

  const dispatch = useDispatch();

  const attachments = useSelector((s: State) => s.plugins?.ols?.get('attachments'));
  const chatHistory: ImmutableList<ChatEntry> = useSelector((s: State) =>
    s.plugins?.ols?.get('chatHistory'),
  );

  let k8sWatchOptions;

  // Do we have a context in Redux that looks like a k8s resource with sufficient information
  const context: K8sResourceKind = useSelector((s: State) => s.plugins?.ols?.get('context'));
  if (
    context &&
    typeof context.kind === 'string' &&
    typeof context.metadata?.name === 'string' &&
    typeof context.metadata?.namespace === 'string'
  ) {
    k8sWatchOptions = {
      isList: false,
      kind: context.kind,
      name: context.metadata?.name,
      namespace: context.metadata?.namespace,
    };
  }

  const [kind, name, namespace] = useLocationContext();

  // If we didn't get a k8s resource context from Redux, can we get one from the current page?
  if (!k8sWatchOptions && kind && kind !== 'Alert' && name) {
    k8sWatchOptions = { isList: false, kind, name, namespace };
  }

  const k8sContext = useK8sWatchResource<K8sResourceKind>(k8sWatchOptions ?? null);

  const [attachContext] =
    kind === 'Alert' && name ? [{ kind, metadata: { name, namespace } }] : k8sContext;

  const conversationID: string = useSelector((s: State) => s.plugins?.ols?.get('conversationID'));
  const query: string = useSelector((s: State) => s.plugins?.ols?.get('query'));

  const [validated, setValidated] = React.useState<'default' | 'error'>('default');

  const [authStatus] = useAuth();

  const [isNewChatModalOpen, , openNewChatModal, closeNewChatModal] = useBoolean(false);
  const [isWaiting, , setWaiting, unsetWaiting] = useBoolean(false);

  const chatHistoryEndRef = React.useRef(null);
  const promptRef = React.useRef(null);

  const scrollIntoView = React.useCallback((behavior = 'smooth') => {
    defer(() => {
      chatHistoryEndRef?.current?.scrollIntoView({ behavior });
    });
  }, []);

  // Scroll to bottom of chat after first render (when opening UI that already has chat history)
  React.useEffect(() => {
    scrollIntoView('instant');
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const clearChat = React.useCallback(() => {
    dispatch(setContext(null));
    dispatch(setConversationID(null));
    dispatch(chatHistoryClear());
    dispatch(attachmentsClear());
  }, [dispatch]);

  const onChange = React.useCallback(
    (_e, value) => {
      if (value.trim().length > 0) {
        setValidated('default');
      }
      dispatch(setQuery(value));
    },
    [dispatch],
  );

  const onSubmit = React.useCallback(
    (e) => {
      e.preventDefault();

      if (!query || query.trim().length === 0) {
        setValidated('error');
        return;
      }

      dispatch(
        chatHistoryPush({
          attachments: attachments.map((a) => omit(a, 'originalValue')),
          text: query,
          who: 'user',
        }),
      );
      scrollIntoView();
      setWaiting();

      const requestJSON = {
        attachments: attachments.valueSeq().map(toOLSAttachment),
        // eslint-disable-next-line camelcase
        conversation_id: conversationID,
        query,
      };

      consoleFetchJSON
        .post(QUERY_ENDPOINT, requestJSON, getRequestInitWithAuthHeader(), REQUEST_TIMEOUT)
        .then((response: QueryResponse) => {
          dispatch(setConversationID(response.conversation_id));
          dispatch(
            chatHistoryPush({
              isTruncated: response.truncated === true,
              references: response.referenced_documents,
              text: response.response,
              who: 'ai',
            }),
          );
          scrollIntoView();
          unsetWaiting();
        })
        .catch((error) => {
          dispatch(
            chatHistoryPush({
              error: getFetchErrorMessage(error, t),
              isTruncated: false,
              who: 'ai',
            }),
          );
          scrollIntoView();
          unsetWaiting();
        });

      // Clear prompt input and return focus to it
      dispatch(setQuery(''));
      dispatch(attachmentsClear());
      promptRef.current?.focus();
    },
    [attachments, conversationID, dispatch, query, scrollIntoView, setWaiting, t, unsetWaiting],
  );

  // We use keypress instead of keydown even though keypress is deprecated to work around a problem
  // with IME (input method editor) input. A cleaner solution would be to use the isComposing
  // property, but unfortunately the Safari implementation differs making it unusable for our case.
  const onKeyPress = React.useCallback(
    (e) => {
      // Enter key alone submits the prompt, Shift+Enter inserts a newline
      if (e.key === 'Enter' && !e.shiftKey) {
        e.preventDefault();
        onSubmit(e);
      }
    },
    [onSubmit],
  );

  const onConfirmNewChat = React.useCallback(() => {
    clearChat();
    closeNewChatModal();
  }, [clearChat, closeNewChatModal]);

  const isWelcomePage = chatHistory.size === 0;

  return (
    <Page>
      <PageSection className={isWelcomePage ? undefined : 'ols-plugin__header'} variant="light">
        {onExpand && <ExpandIcon className="ols-plugin__popover-close" onClick={onExpand} />}
        {onCollapse && <CompressIcon className="ols-plugin__popover-close" onClick={onCollapse} />}
        <WindowMinimizeIcon className="ols-plugin__popover-close" onClick={onClose} />
        {!isWelcomePage && (
          <Level>
            <LevelItem>
              <Title className="ols-plugin__heading" headingLevel="h1">
                {t('Red Hat OpenShift Lightspeed')}
              </Title>
            </LevelItem>
            <LevelItem>
              <Button onClick={openNewChatModal} variant="primary">
                {t('Clear chat')}
              </Button>
            </LevelItem>
          </Level>
        )}
      </PageSection>

      <PageSection
        aria-label={t('OpenShift Lightspeed chat history')}
        className="ols-plugin__chat-history"
        hasOverflowScroll
        isFilled
        variant="light"
      >
        {isWelcomePage && <Welcome />}
        <AuthAlert authStatus={authStatus} />
        <PrivacyAlert />
        {chatHistory.toJS().map((entry, i) => (
          <ChatHistoryEntry
            conversationID={conversationID}
            entry={entry}
            entryIndex={i}
            key={i}
            scrollIntoView={scrollIntoView}
          />
        ))}
        {isWaiting && <ChatHistoryEntryWaiting />}
        <ReadinessAlert />
        <div ref={chatHistoryEndRef} />
      </PageSection>

      {authStatus !== AuthStatus.NotAuthenticated && authStatus !== AuthStatus.NotAuthorized && (
        <PageSection className="ols-plugin__chat-prompt" isFilled={false} variant="light">
          <Form onSubmit={onSubmit}>
            <Split hasGutter>
              <SplitItem>
                <AttachMenu context={attachContext} />
              </SplitItem>
              <SplitItem isFilled>
                <TextArea
                  aria-label={t('OpenShift Lightspeed prompt')}
                  autoFocus
                  className="ols-plugin__chat-prompt-input"
                  onChange={onChange}
                  onFocus={(e) => {
                    // Move cursor to the end of the text when popover is closed then reopened
                    const len = e.currentTarget?.value?.length;
                    if (len) {
                      e.currentTarget.setSelectionRange(len, len);
                    }
                  }}
                  onKeyPress={onKeyPress}
                  placeholder={t('Send a message...')}
                  ref={promptRef}
                  resizeOrientation="vertical"
                  rows={Math.min(query.split('\n').length, 12)}
                  validated={validated}
                  value={query}
                />
              </SplitItem>
              <SplitItem className="ols-plugin__chat-prompt-submit">
                <Button className="ols-plugin__chat-prompt-button" type="submit" variant="primary">
                  <PaperPlaneIcon />
                </Button>
              </SplitItem>
            </Split>
          </Form>
          <div className="ols-plugin__chat-prompt-attachments">
            {attachments.keySeq().map((id: string) => {
              const attachment: Attachment = attachments.get(id);
              return (
                <AttachmentLabel
                  attachment={attachment}
                  isEditable
                  key={id}
                  onClose={() => dispatch(attachmentDelete(id))}
                />
              );
            })}
          </div>

          <HelperText>
            <HelperTextItem className="ols-plugin__footer" variant="indeterminate">
              {t('Always check AI/LLM generated responses for accuracy prior to use.')}
            </HelperTextItem>
          </HelperText>

          <AttachmentModal />
          <NewChatModal
            isOpen={isNewChatModalOpen}
            onClose={closeNewChatModal}
            onConfirm={onConfirmNewChat}
          />
        </PageSection>
      )}
    </Page>
  );
};

export default GeneralPage;
