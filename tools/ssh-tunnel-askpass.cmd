@echo off
powershell -NoProfile -Command "[Console]::Out.Write($env:SSH_TUNNEL_PASSWORD)"
