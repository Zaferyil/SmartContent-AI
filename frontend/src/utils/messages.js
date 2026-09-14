import { api } from './api'

/** Direct-message conversations. Omit accountId for every connected channel. */
export const fetchConversations = (accountId) =>
  api('messages-list', accountId ? { query: { accountId } } : undefined)

/** Sends a message to the person in one conversation. */
export const sendMessage = ({ recipientId, text, accountId }) =>
  api('messages-send', { body: { recipientId, text, accountId } })
