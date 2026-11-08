# Self-hosting sync: signaling server and TURN relay

Peer-to-peer sync needs two services the project does not host for you:

1. a **signaling server**, which introduces peers in a room, and
2. optionally, a **TURN relay**, which carries traffic when both peers are
   behind symmetric NAT or a strict corporate firewall.

STUN alone (the default) is enough on most home networks. Everything in this
guide is optional and local-first: without these services the app still works,
and "Sync via file" (a `.dksb` archive exchanged over any channel) needs neither.

## What each service sees

| Service | Sees | Does not see |
|---|---|---|
| Signaling (`wss://`) | room name, connection timing, message sizes, peer IP addresses | encrypted signaling payloads when a room password is set |
| TURN relay (`turns://`) | peer IP addresses, connection durations, traffic volume | document contents (DTLS) and, without the room password, signaling payloads |

TURN credentials authorize a relay that bills by traffic: treat them as secrets.
In the app they are encrypted with a session-scoped AES-GCM key and never appear
in invites, QR codes, URLs or logs (ADR 045).

## 1. Start the services

```bash
cp docs/self-hosting/docker-compose.example.yml docker-compose.yml
# Edit TURN_STATIC_AUTH_SECRET, TURN_REALM and TURN_EXTERNAL_IP.
docker compose up -d
```

The bundled compose file runs:

- `y-webrtc`'s signaling server on port `4444` (WebSocket `ws://localhost:4444`),
- `coturn` on `3478/udp`, `3478/tcp` and `5349/tcp` (TLS), using the `static-auth-secret` long-term credential mechanism.

Put both behind TLS before exposing them: a signaling URL must be `wss://`, and a
TURN URL must be `turns://` unless it only ever serves loopback traffic. The app
rejects plaintext `turn:` URLs to public hosts. Chrome's "insecure WebSocket"
policy and mixed-content blocking would reject them anyway.

## 2. Point the app at them

Copy `.env.example` to `.env.local` and set:

```bash
NEXT_PUBLIC_YJS_SIGNALING_SERVERS=wss://signal.example.com
NEXT_PUBLIC_ICE_SERVERS=[{"urls":["turns:relay.example.com:5349"],"username":"studio","credential":"<secret>"}]
```

`NEXT_PUBLIC_*` values are baked into the client bundle at build time — anyone
who can load the app can read the TURN credential. For a public deployment,
leave `NEXT_PUBLIC_ICE_SERVERS` empty and have each user add the relay in
**Sync → ICE servers**, where it is stored encrypted with the session key.

Users can also add their own relay at runtime; deployment defaults fill the form
when nothing is stored yet, and a URL is validated the same way either way
(`stun:`, `stuns:`, `turn:`, `turns:`; TURN requires a credential pair).

## 3. Verify

1. Open **Sync** in two browsers or devices.
2. Join the same room with the same password.
3. Open **Connection diagnostics** on both:
   - **Signaling** must read `Reachable`,
   - **Peers discovered** must be at least `1`,
   - **Candidate type** reads `host` or `srflx` for a direct path, `relay` when
     TURN carried it.
4. If negotiation fails on both peers, the **Direct connection is blocked**
   notice appears with the self-hosting link and **Sync via file**. Add the TURN
   relay, press **Re-sync**, and confirm the candidate type becomes `relay`.

A relay that is reachable but unused (candidate type stays `host`) is not a
failure: the direct path won. Use a network that blocks UDP and allows TCP/443
to force TURN if you want to prove the relay path works.

## 4. Without any server

**Sync → Sync via file** opens the export view, where a `.dksb` archive can be
downloaded, transferred over any channel, and restored with the integrity
preview and conflict handling that backup already provides. This is the
supported path on networks that block WebRTC entirely.

## Rotating the TURN credential

Change `TURN_STATIC_AUTH_SECRET` (or the static user), restart coturn, then
update `NEXT_PUBLIC_ICE_SERVERS` or re-enter the credential in Sync settings on
each device. Removing a relay from the list deletes it from encrypted storage;
there is no server-side revocation beyond that.
