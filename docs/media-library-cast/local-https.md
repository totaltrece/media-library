# Local HTTPS for Chromecast

Casting already works from `https://media.total13.net`, with picture and sound.
The same direct cast should work from the Windows 11 machine on the LAN, with
the Chromecast fetching videos from that machine. Video bytes must not travel
over the Internet or through the remote server.

This is a proposal. It does not change the Cast integration, transcode files,
or install anything on the television.

## Why local HTTP cannot cast

The local app is started with `pnpm dev` (`tsx watch src/main.ts`). The server
listens for HTTP only, on `PORT` (3000 when unset), on all interfaces.

`http://192.168.1.35:3000` is not a secure origin. Since Chrome 72 the Cast Web
Sender does not start the Presentation API on insecure pages, so the player
reports that this browser did not open media casting. Casting the whole tab
still works because that is a different Chrome feature and does not send the
file. `localhost` is a secure origin for Chrome, but the player rejects it: the
Chromecast cannot open another computer's localhost.

The cast URL is `window.location.origin` plus the signed path
`/api/video/...?cast=`. The server does not choose the host. On that HTTP
address the television would be asked to fetch
`http://192.168.1.35:3000/api/video/...`.

HTTPS is required for both of these, and both come from the same origin:

- The page, so Chrome will open the sender.
- The video URL and `POST /api/cast/links`. The Chromecast downloads the file
  itself and does not send the session cookie. The Default Media Receiver
  (`CC1AD845`) is an HTTPS page hosted by Google.

The remote site already meets both requirements, which is why picture and sound
work there.

## Recommended layout

Leave Node on HTTP port 3000. Put TLS in a reverse proxy on the Windows machine.

| Piece | Role |
| --- | --- |
| A new name, such as `acemagic.total13.net` | Do not reuse `media.total13.net` |
| Public DNS `A` record | Points at `192.168.1.35`, not at the public IP |
| DHCP reservation | That address must stay stable |
| Let's Encrypt certificate via DNS-01 | Proves the name without opening port 80 |
| HTTPS proxy on the Windows machine | Listens on 443 and forwards to `127.0.0.1:3000` |

Open `https://acemagic.total13.net`. Chrome sees a secure origin. The
Chromecast resolves that name with Google DNS (`8.8.8.8`), gets `192.168.1.35`,
and downloads the video from the Windows machine. A `192.168.x.x` address is
not routable from the Internet, so the file stays on the LAN. Do not forward
port 443 on the router.

`media.total13.net` keeps its own certificate and its own `CAST_URL_SECRET`.
The local `.env` secret is separate and is not committed. The token does not
choose the server. The page origin does. The local name sends the television to
the Windows machine. The remote name keeps sending it to the remote server.

The session cookie is not marked `Secure`, so it works on HTTP and HTTPS. Sign
in again on the new name, because the cookie is scoped to the host.

## Private address viability

A Chromecast can open `https://acemagic.total13.net` when that name's public
`A` record is `192.168.1.35`. The certificate is checked against the hostname,
not against whether the address is private. Let's Encrypt will issue that name
through DNS-01. The television then connects to port 443 on the LAN. A private
address is not routable from the Internet, so the video stays on the LAN and
the router does not need a port forward.

Google Public DNS (`8.8.8.8`) returns `192.168.x.x` answers. The Chromecast
queries that resolver and does not use the DNS server from DHCP, so a public
`A` record aimed at the Windows machine is a name the television can resolve.
Home Assistant and Jellyfin use the same pattern.

Chrome treats a page loaded from `192.168.0.0/16` as a local-network site.
Chrome's permission for a public website to enter the LAN does not apply: this
page is already on the LAN, and the video URL is HTTPS on the same origin.

This is not a DNS rebinding attack. Rebinding swaps a public name from a public
address to a private one to fool the browser. Here the name always points at
the same private address, and TLS stops another host from impersonating it.

The real limit is the router. Google Wifi, Nest Wifi, and some other routers
drop DNS answers in which a public name returns a private address. If this
router does that, the television never learns `192.168.1.35` even though
`8.8.8.8` has it. Wi-Fi client isolation would also block the television from
reaching the Windows machine.

Do not publish an `AAAA` record for this name. If one exists, the Chromecast
may prefer IPv6 and skip the LAN address.

### DNS check before any proxy

This check needs no certificate, no proxy, and no open router port. Nothing is
installed on the television.

1. Create only the `A` record for `acemagic.total13.net` pointing at
   `192.168.1.35`.
2. On the Windows machine, run both lookups:

   ```text
   nslookup acemagic.total13.net 8.8.8.8
   nslookup acemagic.total13.net
   ```

   Both must answer `192.168.1.35`. The first is what the Chromecast sees. The
   second is what the PC sees. If only the first succeeds, the router is
   filtering the answer and Chrome will not open the page.

If `8.8.8.8` does not return `192.168.1.35`, this layout will not work on this
network. The LAN-only remedy is to turn off the router's DNS rebinding
protection, or set its DNS servers to `8.8.8.8` and `8.8.4.4`, then repeat both
lookups. Forwarding port 443, or sending the file through the remote server,
does not meet the goal.

The Chromecast's HTTPS fetch cannot be proven until a publicly trusted
certificate exists and something answers on port 443. A private or staging
certificate would be rejected by the receiver even when DNS is correct. That
listener comes after this DNS check, and it can be a one-off certificate
before automatic renewal is set up.

## Certificates

A private CA, mkcert, or a self-signed certificate installed only on Windows is
not enough.

- Chrome on the PC would trust it, and the sender could start.
- The Chromecast does not use the Windows certificate store. It has its own
  public CA set, and a private root cannot be added without changing the
  device. A private CA leaves the receiver unable to play the video. Let's
  Encrypt is already in that store.
- A public CA will not sign a certificate for `192.168.1.35`. The DNS name is
  required.

The certificate must cover `acemagic.total13.net` exactly. DNS-01 only needs
permission to create the TXT record in the `total13.net` DNS. The Windows
machine does not have to be reachable from the Internet. Renew about every 90
days. The proxy can renew it when the DNS host has an API.

Router-only DNS is not enough. The Chromecast queries `8.8.8.8` and ignores the
DNS server handed out by DHCP. The `A` record must exist in public DNS. Check
with `nslookup acemagic.total13.net 8.8.8.8`. It must return `192.168.1.35`.

On Windows Firewall, allow inbound TCP 443 on the private network profile only.

## Files

The proxy approach does not change application code, the remote `.env`, or how
`media.total13.net` starts.

Outside the repository, on the Windows machine:

- The DNS record and the DHCP reservation.
- The proxy configuration and the certificate files.
- A firewall rule for port 443.

This document is the only repository file for the proposal.

Putting TLS inside Fastify is optional and harder to keep separate from the
remote server. That would change `backend/src/main.ts`, `backend/src/config.ts`,
and the `.env` example. Do not do that. The remote and local setups should not
share one startup path.

## Checks

1. Reserve `192.168.1.35` for the Windows machine.
2. Create `acemagic.total13.net` pointing at `192.168.1.35` in public DNS.
3. Confirm both lookups in the DNS check above return `192.168.1.35`. Stop
   here if they do not.
4. Issue the certificate with DNS-01 and proxy port 443 to `127.0.0.1:3000`.
5. Open `https://acemagic.total13.net`. The lock must be valid, with no warning.
6. Sign in and cast an MP4 that already has sound on the remote server. Picture
   and sound should both play.
7. During playback, the Windows machine should show a connection to port 443
   from the Chromecast's LAN address.
8. Cast once from `https://media.total13.net` and confirm the remote path is
   unchanged.
9. `http://192.168.1.35:3000` may still open the library. Cast from that URL
   should still show the HTTP message.
