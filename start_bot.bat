@echo off
title Telegram Bot - Tasks Assistant
cd /d %~dp0
echo Starting Telegram Bot...
:loop
node node_modules\tsx\dist\cli.mjs src/bot/server.ts
echo Bot crashed or stopped. Restarting in 5 seconds...
timeout /t 5
goto loop
