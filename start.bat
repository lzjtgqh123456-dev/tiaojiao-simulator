@echo off
chcp 65001 >nul
cd /d "%~dp0"
title 调教模拟器 - 独立桌面应用

if exist "C:\Program Files\nodejs\node.exe" set "PATH=C:\Program Files\nodejs;%PATH%"
if exist "C:\Program Files (x86)\nodejs\node.exe" set "PATH=C:\Program Files (x86)\nodejs;%PATH%"
if exist "%LOCALAPPDATA%\Programs\nodejs\node.exe" set "PATH=%LOCALAPPDATA%\Programs\nodejs;%PATH%"

where node >nul 2>nul
if %errorlevel% neq 0 (
    echo ========================================================
    echo [错误] 本机未检测到 Node.js 运行环境。
    echo 请前往官网下载并安装 Node.js: https://nodejs.org/
    echo ========================================================
    echo.
    pause
    exit /b 1
)

node start.js
if %errorlevel% neq 0 (
    echo.
    echo [提示] 调教模拟器 独立程序已退出。所有数据已自动保存。
    pause
)
