/**
 * Connection diagnostics and ICE settings messages (#1052).
 *
 * Scope module for `sync-connection-panel.tsx`, following the per-view i18n
 * convention in `src/lib/i18n/t.ts`.
 */
import { makeT } from '@/lib/i18n/t'

const messages = {
  /** Panel heading. */
  'syncConnection.title': 'Connection diagnostics',
  /** Explanation of what the panel reads. */
  'syncConnection.description':
    'What the browser can see about this room, stage by stage. Nothing here leaves your device.',
  /** Row label: signaling server reachability. */
  'syncConnection.signaling': 'Signaling',
  /** Row value when the signaling socket is open. */
  'syncConnection.signalingReachable': 'Reachable',
  /** Row value when the signaling socket is closed. */
  'syncConnection.signalingUnreachable': 'Unreachable',
  /** Row label: peers found in the room. */
  'syncConnection.peers': 'Peers discovered',
  /** Row value for the discovered peer count; count interpolated. */
  'syncConnection.peersValue': (count: string) => (count === '1' ? '1 peer' : `${count} peers`),
  /** Row label: ICE connection state. */
  'syncConnection.iceState': 'ICE state',
  /** Row label: selected candidate type. */
  'syncConnection.candidate': 'Candidate type',
  /** Row value before anything is negotiated. */
  'syncConnection.notNegotiated': 'Not negotiated yet',
  /** Row value when no room is joined. */
  'syncConnection.noRoom': 'No room joined',

  /** Hint before a room is joined. */
  'syncConnection.hint.idle': 'Join a room to see why peers can or cannot reach you.',
  /** Hint when the signaling socket is not open. */
  'syncConnection.hint.signalingUnreachable':
    'The signaling server could not be reached. Check the network, the server URL, or self-host signaling.',
  /** Hint when signaling is up but no peer announced itself. */
  'syncConnection.hint.noPeers':
    'Signaling works, but no other peer is in this room yet. Check the room ID and password on the other device.',
  /** Hint while negotiation is still in progress. */
  'syncConnection.hint.negotiating':
    'Peers found each other and the browser is negotiating a direct connection.',
  /** Hint when a direct candidate carried the connection. */
  'syncConnection.hint.connectedDirect':
    'Connected directly. No relay is in use, so no TURN cost or TURN metadata exposure applies.',
  /** Hint when a relay carried the connection. */
  'syncConnection.hint.connectedRelay':
    'Connected through a TURN relay. The relay sees your IP address and the volume of encrypted traffic, but not its contents.',
  /** Hint when a peer was found but no candidate pair succeeded. */
  'syncConnection.hint.natBlocked':
    'Peers were found but no connection succeeded. Symmetric NAT or a strict firewall is likely: add a TURN server, or sync through a file instead.',

  /** Hint when a relay was selected but the connection still failed. */
  'syncConnection.hint.relayFailed':
    'A relay was selected but the connection still failed. Check the TURN credential and that the relay is reachable, or sync through a file instead.',

  /** Heading of the recovery block. */
  'syncConnection.blockedTitle': 'Direct connection is blocked',
  /** Recovery guidance. */
  'syncConnection.blockedBody':
    'Add a TURN relay below, self-host signaling, or exchange a .dksb archive without any network connection.',
  /** Link to the self-hosting guide. */
  'syncConnection.selfHosting': 'Self-hosting guide',
  /** Action that opens the file-based sync fallback. */
  'syncConnection.fileFallback': 'Sync via file',

  /** Heading of the ICE settings section. */
  'syncIce.title': 'ICE servers (STUN / TURN)',
  /** Explanation of why a TURN relay may be needed. */
  'syncIce.description':
    'STUN is enough on most home networks. Behind symmetric NAT or a corporate firewall, only a TURN relay connects peers. The credential is encrypted and never leaves this device.',
  /** Placeholder for the URL field. */
  'syncIce.urlPlaceholder': 'turns:relay.example.com:5349',
  /** URL field label. */
  'syncIce.url': 'Server URL',
  /** Username field label. */
  'syncIce.username': 'Username',
  /** Credential field label. */
  'syncIce.credential': 'Credential',
  /** Checkbox that permits plaintext TURN for a lab relay. */
  'syncIce.allowInsecure': 'Allow plaintext turn: URLs',
  /** Add button label. */
  'syncIce.add': 'Add server',
  /** Remove button label. */
  'syncIce.remove': 'Remove',
  /** Empty state. */
  'syncIce.empty': 'No relay configured. Only STUN defaults apply.',
  /** Badge on a server with stored credentials. */
  'syncIce.authenticated': 'credentials stored',
  /** Toast after a successful save. */
  'syncIce.saved': 'ICE servers saved',
  /** Fallback error message. */
  'syncIce.saveFailed': 'Could not save the ICE configuration.',
  /** Note about deployment-provided defaults. */
  'syncIce.envDefaults': 'Deployment defaults come from NEXT_PUBLIC_ICE_SERVERS.',
  /** Validation summary; count interpolated. */
  'syncIce.issueCount': (count: string) => `${count} problem(s) with the ICE configuration`,
} as const

/** Typed `translate` helper bound to the sync connection message scope. */
export const translate = makeT(messages)
