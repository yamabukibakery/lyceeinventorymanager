@echo off
cd /d C:\Users\willi\Desktop\dev\lyceeinventorymanager
set PATH=C:\Users\willi\Desktop\dev\lyceeinventorymanager\.tools\node-v22.14.0-win-x64;%PATH%
title Lycee Inventory Server
.\.tools\node-v22.14.0-win-x64\node.exe src\server.js
