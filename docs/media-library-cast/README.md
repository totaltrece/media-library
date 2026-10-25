# Casting to Chromecast and downloading video

The player can send the current video to a Chromecast and, for a signed-in
`view` or `admin` user, download the original file.

Casting does not copy or transcode the library. The television plays the same
file the browser streams.

## What happens when you press Cast

1. The player refuses `localhost`, `127.0.0.1`, and `::1`. A Chromecast cannot
   open those addresses. Open Media Library with a host the television can
   reach, such as `http://192.168.1.20:3000` or `https://library.example.com`.
2. The browser calls `POST /api/cast/links` with the video id. A `view`
   session is enough. The response is a relative `streamPath` that already
   contains a short-lived `cast` token.
3. The page turns that path into an absolute URL with `window.location.origin`.
   The server does not invent the host, because the host the user opened is
   the one the Chromecast must use.
4. Desktop Chrome or Edge loads the Google Cast sender and asks which device
   to use. Chrome may report the sender as unavailable once while it starts;
   the player waits and tries again. After a device is chosen, the session is
   read with `getCurrentSession()`, because `requestSession()` does not return
   it. The sender tells Google's Default Media Receiver (`CC1AD845`) to play
   the signed URL. No custom Cast application has to be registered. A phone
   does not include that sender. There the player asks the browser to cast
   the signed video URL itself. Casting the whole browser tab is a different
   Chrome control and does not send this file.
5. The Chromecast fetches the URL itself. It does not send the session
   cookie, so the token is what authorizes that one video until it expires.
   Range requests keep working for seeking. The local player pauses so the
   sound is not doubled.

Canceling the device picker leaves the page as it was.

The cast icon sits on the video, at the top right. Download stays under the video. The
browser's own remote-playback control stays off until a cast starts, and then
it receives the signed URL rather than the cookie address.

## Signed links

The token is `expiry.hmac`. The HMAC is SHA-256 over the media id and the
expiry, keyed with `CAST_URL_SECRET`. A token for one video does not play
another. Verification uses a constant-time compare.

| Variable | Meaning |
| --- | --- |
| `CAST_URL_SECRET` | HMAC key. Set this in production. If it is empty, the process generates a key and every existing cast link dies on restart. |
| `CAST_URL_TTL_SECONDS` | Link lifetime. Default `21600` (6 hours). Allowed range: 60–86400. |

The cast response is `Cache-Control: no-store`. A cast stream is
`Cache-Control: private` and allows any origin to read it
(`Access-Control-Allow-Origin: *`). That does not expose cookie-authenticated
video: browsers do not attach the session cookie to a wildcard cross-origin
response. `OPTIONS /api/video/*` is allowed without a session so the
receiver's preflight can succeed. It returns no bytes.

## Network requirements

The Chromecast and the machine running Media Library must be able to reach
each other.

- Use Chrome or Edge. Firefox and Safari do not include the Cast sender.
- Do not open the app as `localhost` if you want to cast.
- The television must be on a network that can route to the page origin.
- Prefer HTTPS with a certificate the Chromecast already trusts (a public
  CA). The Default Media Receiver is an HTTPS page. Many devices refuse to
  play an `http://` video from that page, and they will not trust a
  self-signed certificate. If the TV stays blank, serve the app over HTTPS
  and open that HTTPS address in the browser. The player says so when the
  page itself is HTTP.
- A reverse proxy must forward `Range`, `GET`, `HEAD`, and `OPTIONS` for
  `/api/video/*`, and it must not strip the `cast` query.

## Formats

`receiverCompatible` is true only for `video/mp4` and `video/webm`. Those are
the types the Default Media Receiver is expected to play. MP4 should be
H.264 video with AAC audio. MKV, AVI, MPEG-TS, and HEVC often fail on the
television even when the browser plays them. This feature does not transcode
for cast.

Content types served for the stream:

| Extension | Content-Type |
| --- | --- |
| `.mp4`, `.m4v` | `video/mp4` |
| `.webm` | `video/webm` |
| `.mov` | `video/quicktime` |
| `.mkv` | `video/x-matroska` |
| `.ts` | `video/mp2t` |
| `.avi` | `video/x-msvideo` |

`.m4v`, `.webm`, and `.ts` previously fell through to
`application/octet-stream`. They now use the types above so a receiver can
identify the file.

## Download

Signed-in `view` and `admin` users see **Download** in the player and the
browser's native video download control. Anonymous sessions keep
`controlsList="nodownload"` and do not see the link.

Download requests `GET /api/video/:id?download=1`. The response is the
original file with `Content-Disposition: attachment`. The session cookie
authorizes it, the same way playback does. A cast token does not force a
download: `download=1` is ignored when `cast` is present, so a cast URL stays
playable.

## Roles

| Action | Anonymous, public read off | `view` | `admin` |
| --- | --- | --- | --- |
| Watch with the session cookie | no | yes | yes |
| Download | no | yes | yes |
| `POST /api/cast/links` | no | yes | yes |
| Play `?cast=` without a cookie | only with a valid token | yes | yes |
| Change tags, upload, delete | no | no | yes |

When `AUTH_PUBLIC_READ` is not `false`, anonymous visitors can already read
the stream. They can also request a cast link. The player still hides
Download unless the session is `view` or `admin`.
