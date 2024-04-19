import { action, ActionType as Action } from 'typesafe-actions';

import { ChatEntry } from './types';

export enum ActionType {
  AttachmentAdd = 'attachmentAdd',
  AttachmentDelete = 'attachmentDelete',
  ChatHistoryClear = 'chatHistoryClear',
  ChatHistoryPush = 'chatHistoryPush',
  CloseOLS = 'closeOLS',
  DismissPrivacyAlert = 'dismissPrivacyAlert',
  OpenOLS = 'openOLS',
  SetContext = 'setContext',
  SetQuery = 'setQuery',
  UserFeedbackClose = 'userFeedbackClose',
  UserFeedbackOpen = 'userFeedbackOpen',
  UserFeedbackSetSentiment = 'userFeedbackSetSentiment',
  UserFeedbackSetText = 'userFeedbackSetText',
}

export const attachmentAdd = (
  attachmentType: string,
  kind: string,
  name: string,
  namespace: string,
  value: string,
) => action(ActionType.AttachmentAdd, { attachmentType, kind, name, namespace, value });
export const attachmentDelete = (id: string) => action(ActionType.AttachmentDelete, { id });
export const chatHistoryClear = () => action(ActionType.ChatHistoryClear);
export const chatHistoryPush = (entry: ChatEntry) => action(ActionType.ChatHistoryPush, { entry });
export const closeOLS = () => action(ActionType.CloseOLS);
export const dismissPrivacyAlert = () => action(ActionType.DismissPrivacyAlert);
export const openOLS = () => action(ActionType.OpenOLS);
export const setContext = (context: object) => action(ActionType.SetContext, { context });
export const setQuery = (query: string) => action(ActionType.SetQuery, { query });
export const userFeedbackClose = (entryIndex: number) =>
  action(ActionType.UserFeedbackClose, { entryIndex });
export const userFeedbackOpen = (entryIndex: number) =>
  action(ActionType.UserFeedbackOpen, { entryIndex });
export const userFeedbackSetSentiment = (entryIndex: number, sentiment: number) =>
  action(ActionType.UserFeedbackSetSentiment, { entryIndex, sentiment });
export const userFeedbackSetText = (entryIndex: number, text: string) =>
  action(ActionType.UserFeedbackSetText, { entryIndex, text });

const actions = {
  attachmentAdd,
  attachmentDelete,
  chatHistoryClear,
  chatHistoryPush,
  closeOLS,
  dismissPrivacyAlert,
  openOLS,
  setContext,
  setQuery,
  userFeedbackClose,
  userFeedbackOpen,
  userFeedbackSetSentiment,
  userFeedbackSetText,
};

export type OLSAction = Action<typeof actions>;
