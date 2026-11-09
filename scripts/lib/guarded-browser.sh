#!/bin/sh
# Starts the render browser so that only this computer's own render server can be reached.
exec "$VIDEO_GEN_REAL_BROWSER" "--host-resolver-rules=MAP * ~NOTFOUND, EXCLUDE localhost, EXCLUDE 127.0.0.1" "$@"
