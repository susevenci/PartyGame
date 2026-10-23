@echo off
chcp 65001 >nul
setlocal
cd /d "%~dp0"
title 聚会小游戏 - 开发模式

echo ============================================
echo   聚会小游戏 一键启动（开发模式）
echo   server:3000   client:5173   Ctrl+C 退出
echo ============================================
echo.

where node >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 Node.js，请先安装 Node 20 或更高版本：https://nodejs.org/
  pause
  exit /b 1
)

where npm.cmd >nul 2>nul
if errorlevel 1 (
  echo [错误] 未检测到 npm，请重新安装 Node.js。
  pause
  exit /b 1
)

if not exist "node_modules" (
  echo [1/2] 首次运行：安装依赖（npm install）...
  call npm.cmd install
  if errorlevel 1 goto :fail
) else (
  echo [1/2] 依赖已就绪，跳过安装。
)

echo [2/2] 构建 shared 并同时启动前后端...
echo.
call npm.cmd run dev
if errorlevel 1 goto :fail
goto :eof

:fail
echo.
echo [错误] 启动失败，请查看上方日志。
pause
exit /b 1
