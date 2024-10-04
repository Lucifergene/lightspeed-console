import { action, ActionType as Action } from 'typesafe-actions';

import { Attachment, ChatEntry, CodeBlock } from './types';

export enum ActionType {
  AddContextEvent = 'addContextEvent',
  AttachmentDelete = 'attachmentDelete',
  AttachmentsClear = 'attachmentsClear',
  AttachmentSet = 'attachmentSet',
  ChatHistoryClear = 'chatHistoryClear',
  ChatHistoryPush = 'chatHistoryPush',
  ClearContextEvents = 'clearContextEvents',
  CloseOLS = 'closeOLS',
  OpenAttachmentClear = 'openAttachmentClear',
  OpenAttachmentSet = 'openAttachmentSet',
  OpenOLS = 'openOLS',
  SetContext = 'setContext',
  SetConversationID = 'setConversationID',
  SetIsContextEventsLoading = 'setIsContextEventsLoading',
  SetQuery = 'setQuery',
  UserFeedbackClose = 'userFeedbackClose',
  UserFeedbackDisable = 'userFeedbackDisable',
  UserFeedbackOpen = 'userFeedbackOpen',
  UserFeedbackSetSentiment = 'userFeedbackSetSentiment',
  UserFeedbackSetText = 'userFeedbackSetText',
  ImportCodeblock = 'importCodeblock',
}

export const addContextEvent = (event: object) => action(ActionType.AddContextEvent, { event });

export const attachmentDelete = (id: string) => action(ActionType.AttachmentDelete, { id });

export const attachmentsClear = () => action(ActionType.AttachmentsClear);

export const attachmentSet = (
  attachmentType: string,
  kind: string,
  name: string,
  ownerName: string,
  namespace: string,
  value: string,
  originalValue?: string,
) =>
  action(ActionType.AttachmentSet, {
    attachmentType,
    kind,
    name,
    namespace,
    originalValue,
    ownerName,
    value,
  });

export const chatHistoryClear = () => action(ActionType.ChatHistoryClear);

export const chatHistoryPush = (entry: ChatEntry) => action(ActionType.ChatHistoryPush, { entry });

export const clearContextEvents = () => action(ActionType.ClearContextEvents);

export const closeOLS = () => action(ActionType.CloseOLS);

export const openAttachmentClear = () => action(ActionType.OpenAttachmentClear);

export const openAttachmentSet = (attachment: Attachment) =>
  action(ActionType.OpenAttachmentSet, { attachment });

export const openOLS = () => action(ActionType.OpenOLS);

export const setContext = (context: object) => action(ActionType.SetContext, { context });

export const setConversationID = (id: string) => action(ActionType.SetConversationID, { id });

export const setIsContextEventsLoading = (isLoading: boolean) =>
  action(ActionType.SetIsContextEventsLoading, { isLoading });

export const setQuery = (query: string) => action(ActionType.SetQuery, { query });

export const userFeedbackClose = (entryIndex: number) =>
  action(ActionType.UserFeedbackClose, { entryIndex });

export const userFeedbackDisable = () => action(ActionType.UserFeedbackDisable);

export const userFeedbackOpen = (entryIndex: number) =>
  action(ActionType.UserFeedbackOpen, { entryIndex });

export const userFeedbackSetSentiment = (entryIndex: number, sentiment: number) =>
  action(ActionType.UserFeedbackSetSentiment, { entryIndex, sentiment });

export const userFeedbackSetText = (entryIndex: number, text: string) =>
  action(ActionType.UserFeedbackSetText, { entryIndex, text });

export const importCodeblock = (code: CodeBlock) => action(ActionType.ImportCodeblock, { code });

// eslint-disable-next-line @typescript-eslint/no-unused-vars
const actions = {
  addContextEvent,
  attachmentDelete,
  attachmentsClear,
  attachmentSet,
  chatHistoryClear,
  chatHistoryPush,
  clearContextEvents,
  closeOLS,
  openAttachmentClear,
  openAttachmentSet,
  openOLS,
  setContext,
  setConversationID,
  setIsContextEventsLoading,
  setQuery,
  userFeedbackClose,
  userFeedbackDisable,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
  importCodeblock,
};

export type OLSAction = Action<typeof actions>;
