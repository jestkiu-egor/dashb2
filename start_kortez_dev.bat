@echo off
echo Starting Cosmoproject Manager on port 7777...
set PORT=7777
"C:\Program Files\nodejs\npm.cmd" run dev -- --port 7777
pause
