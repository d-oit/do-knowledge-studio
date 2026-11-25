'use client'

/**
 * React binding for the at-rest session (ADR 048).
 *
 * The session itself is module state outside React, so it is read through
 * `useSyncExternalStore`. The server snapshot is `'off'`, which keeps the
 * server-rendered markup identical to the first client render; the flag can
 * only be known in the browser.
 */
import { useSyncExternalStore } from 'react'
import {
  getAtRestSessionStatus,
  subscribeToAtRestSession,
  type AtRestSessionStatus,
} from './at-rest-session'

/** Subscribes React to lock/unlock and flag changes. */
const subscribe = (listener: () => void): (() => void) => subscribeToAtRestSession(listener)

/** Reads the live session status. */
const readStatus = (): AtRestSessionStatus => getAtRestSessionStatus()

/** Server/first-render status; encryption is a browser-only fact. */
const readServerStatus = (): AtRestSessionStatus => 'off'

/** The workspace's encryption status, re-rendering on every change. */
export const useAtRestSessionStatus = (): AtRestSessionStatus =>
  useSyncExternalStore(subscribe, readStatus, readServerStatus)
