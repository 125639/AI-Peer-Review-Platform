@echo off
chcp 65001 >nul
REM AI 聊天应用 Docker 启动脚本 (Windows)
REM 使用方法：启动脚本.bat [生产|开发|停止|重启|日志]

setlocal enabledelayedexpansion

REM 切换到项目根目录
cd /d "%~dp0.."

REM 检查 Docker 是否安装
where docker >nul 2>nul
if %errorlevel% neq 0 (
    echo [错误] Docker 未安装。请先安装 Docker Desktop。
    pause
    exit /b 1
)

REM 检查 docker-compose
where docker-compose >nul 2>nul
if %errorlevel% equ 0 (
    set DOCKER_COMPOSE=docker-compose
) else (
    set DOCKER_COMPOSE=docker compose
)

echo [√] Docker 环境检查通过

REM 解析命令参数
set COMMAND=%1
if "%COMMAND%"=="" set COMMAND=生产

REM 执行相应命令
if /i "%COMMAND%"=="生产" goto :start_production
if /i "%COMMAND%"=="production" goto :start_production
if /i "%COMMAND%"=="prod" goto :start_production

if /i "%COMMAND%"=="开发" goto :start_development
if /i "%COMMAND%"=="development" goto :start_development
if /i "%COMMAND%"=="dev" goto :start_development

if /i "%COMMAND%"=="停止" goto :stop_services
if /i "%COMMAND%"=="stop" goto :stop_services

if /i "%COMMAND%"=="重启" goto :restart_services
if /i "%COMMAND%"=="restart" goto :restart_services

if /i "%COMMAND%"=="日志" goto :show_logs
if /i "%COMMAND%"=="logs" goto :show_logs

if /i "%COMMAND%"=="状态" goto :show_status
if /i "%COMMAND%"=="status" goto :show_status

if /i "%COMMAND%"=="构建" goto :build_image
if /i "%COMMAND%"=="build" goto :build_image

if /i "%COMMAND%"=="帮助" goto :show_help
if /i "%COMMAND%"=="help" goto :show_help
if /i "%COMMAND%"=="-h" goto :show_help
if /i "%COMMAND%"=="--help" goto :show_help

echo [错误] 未知命令: %COMMAND%
goto :show_help

:start_production
echo [启动] 启动生产环境...
%DOCKER_COMPOSE% -f docker文件/docker-compose.yml up -d
if %errorlevel% equ 0 (
    echo [√] 生产环境启动成功！
    echo [信息] 访问地址: http://localhost:8000
    echo [信息] 查看日志: 启动脚本.bat 日志
) else (
    echo [错误] 启动失败
)
pause
goto :eof

:start_development
echo [启动] 启动开发环境（支持热重载）...
%DOCKER_COMPOSE% -f docker文件/docker-compose.dev.yml up -d
if %errorlevel% equ 0 (
    echo [√] 开发环境启动成功！
    echo [信息] 访问地址: http://localhost:8000
    echo [信息] 查看日志: 启动脚本.bat 日志 开发
) else (
    echo [错误] 启动失败
)
pause
goto :eof

:stop_services
echo [停止] 停止所有服务...
%DOCKER_COMPOSE% -f docker文件/docker-compose.yml down 2>nul
%DOCKER_COMPOSE% -f docker文件/docker-compose.dev.yml down 2>nul
echo [√] 服务已停止
pause
goto :eof

:restart_services
echo [重启] 重启服务...
call :stop_services
timeout /t 2 /nobreak >nul
call :start_production
goto :eof

:show_logs
set ENV_TYPE=%2
if "%ENV_TYPE%"=="开发" (
    echo [日志] 显示开发环境日志（Ctrl+C 退出）...
    %DOCKER_COMPOSE% -f docker文件/docker-compose.dev.yml logs -f
) else (
    echo [日志] 显示生产环境日志（Ctrl+C 退出）...
    %DOCKER_COMPOSE% -f docker文件/docker-compose.yml logs -f
)
goto :eof

:show_status
echo [状态] 服务运行状态:
docker ps --filter "name=ai-chat-app"
pause
goto :eof

:build_image
echo [构建] 构建 Docker 镜像...
%DOCKER_COMPOSE% -f docker文件/docker-compose.yml build --no-cache
if %errorlevel% equ 0 (
    echo [√] 镜像构建完成
) else (
    echo [错误] 构建失败
)
pause
goto :eof

:show_help
echo ========================================
echo   AI 聊天应用 Docker 启动脚本
echo ========================================
echo.
echo 使用方法: 启动脚本.bat [命令]
echo.
echo 命令:
echo   生产      启动生产环境（默认）
echo   开发      启动开发环境（支持热重载）
echo   停止      停止所有服务
echo   重启      重启生产环境
echo   日志      查看生产环境日志
echo   状态      查看服务运行状态
echo   构建      重新构建 Docker 镜像
echo   帮助      显示此帮助信息
echo.
echo 示例:
echo   启动脚本.bat 生产
echo   启动脚本.bat 开发
echo   启动脚本.bat 日志
echo.
pause
goto :eof

