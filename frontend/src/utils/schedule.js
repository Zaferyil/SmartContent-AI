import { api } from './api'

/** The calendar, the publishing settings, and what the server can actually publish to. */
export const fetchSchedule = () => api('schedule-list')

/** Creates or updates scheduled posts. Takes a list so AI planning is one write. */
export const saveScheduled = (items) =>
  api('schedule-save', { body: { items } }).then((data) => data.items)

export const deleteScheduled = (ids) =>
  api('schedule-delete', { body: { ids } }).then((data) => data.items)

export const saveSettings = (settings) =>
  api('settings-save', { body: settings }).then((data) => data.settings)

/** The connected social accounts, without their tokens. */
export const fetchAccounts = () => api('accounts-list').then((data) => data.accounts)

/**
 * Whether this deploy can store anything, and if not, what is wrong.
 *
 * Shown in the app rather than left to a URL only a developer would think to
 * open: when storage is broken every screen looks merely empty, which is the
 * hardest failure to recognise.
 */
export const fetchStorageStatus = () => api('storage-status')

/**
 * Connects an account from its token alone — the server reads back which
 * account it is and refuses a token it cannot identify.
 */
export const addAccount = (token) =>
  api('accounts-add', { body: { token } }).then((data) => data.account)

export const removeAccount = (id) =>
  api('accounts-remove', { body: { id } }).then((data) => data.accounts)
