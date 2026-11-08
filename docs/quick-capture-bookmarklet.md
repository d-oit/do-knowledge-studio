# Quick capture bookmarklet (#1061)

Drag this to your bookmarks bar, then click it on any page to open the studio
with the selection pre-filled. Content is treated as untrusted and never saved
until you confirm in the capture screen.

```js
javascript:(function(){const t=document.title;const s=(window.getSelection()||'').toString();const u=location.href;const q=new URLSearchParams({share:'1',title:t,text:s,url:u});location.href='/?'+q.toString()+'#/editor'})()
```

Platform support:

- Android Chrome: `share_target` receives text/title/url once the PWA is installed.
- Desktop Chromium: share via OS share sheet works when installed.
- iOS Safari: `share_target` is not supported; use the bookmarklet instead.
- Offline: works once the PWA is installed (queued until the app opens).
