STUDIOFLOW SPLASH VIDEO
=======================

Drop your finished animation in this folder as:

    assets/splash.mp4        (preferred)
  or assets/splash.webm

That is the only step. StudioFlow looks for it every launch. If it is there, it plays.
If it is not, the built-in wave animation plays instead, so nothing breaks either way.

WHAT TO ASK THE VIDEO TOOL FOR
------------------------------
  Resolution   1920 x 1080 (16:9). It is cropped to fill, so keep the logo well
               inside the middle - the edges may be trimmed on a different window shape.
  Length       6 to 10 seconds. The splash currently holds for about 5 seconds and
               then waits for StudioFlow to finish loading, so anything in that
               range plays through. The last frame is held, never looped.
  Format       H.264 MP4 is the safest. VP9 WebM also works.
  Audio        NONE. Strip the audio track - the splash is deliberately silent.
  File size    Under about 15 MB. It is bundled into the installer.

WHAT THE FINAL FRAME SHOULD LOOK LIKE
-------------------------------------
End on the logo, reasonably centred, on a dark background. StudioFlow draws the
loading bar and "Loading StudioFlow..." over the lower part of the picture, so
leave the bottom fifth free of anything important.

CHECKING IT
-----------
Start StudioFlow. If the film plays, it worked. If you still see the blue wave
animation, StudioFlow could not read the file - most often the wrong filename,
or a codec Chrome will not decode. Re-export as H.264 MP4 and try again.
