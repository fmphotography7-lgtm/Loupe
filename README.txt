LOUPE — getting it onto phones and desktops
===========================================

WHAT IS IN HERE
  index.html               the whole app
  manifest.webmanifest     what makes it installable
  sw.js                    lets it run with no signal
  icon-*.png               home screen icons

Nothing here talks to a server. Every photo stays on the device.


TEST IT RIGHT NOW ON YOUR ANDROID PHONE
  1. Put loupe.html (the single-file version) in your phone's Downloads.
  2. Open the Files app, tap it, and choose Chrome when asked how to open it.
     Opening it INSIDE another app's preview will not work — those previews
     block the photo picker, and no version of this file can get around that.
  3. Tap Photos. Your camera roll should open.


PUT IT ON THE WEB SO ANYONE CAN USE IT
This is the step that makes it work on Android and iPhone equally, with no
app store involved. Upload all the files in this folder, together, to any
web host that serves https. Free options that take about ten minutes:

  - Netlify Drop (app.netlify.com/drop): drag this folder onto the page.
    You get a URL immediately. No account needed to start.
  - GitHub Pages: put these files in a repo, turn on Pages in settings.
  - Your existing site: upload as a subfolder, e.g. /loupe/

https matters. Installing and offline use will not work over plain http.

Once it is live:
  ANDROID   Open the URL in Chrome. Tap Install in the top bar, or use
            Chrome's menu ▸ Add to Home screen.
  IPHONE    Open the URL in Safari. Share ▸ Add to Home Screen.
  DESKTOP   Chrome and Edge show an install icon in the address bar.

After that it opens from the home screen like any other app, works with no
signal, and updates whenever you re-upload.


WHEN YOU CHANGE THE APP
Edit index.html, then open sw.js and change the line:

    const CACHE = 'loupe-v1';

to 'loupe-v2', 'loupe-v3' and so on. Phones hold on to the old version
until that name changes. This is the single most common reason a change
does not show up.


IF YOU LATER WANT IT IN THE PLAY STORE AND APP STORE
The same files go into a wrapper — Capacitor is the usual choice, and it
produces a real Android and iOS project from exactly this folder. That
route needs a Google Play developer account (one payment) and an Apple
developer account (yearly), plus a Mac to build the iPhone version.
Worth doing only if you want the store listing. The home screen install
above gives you the same app without any of that.
