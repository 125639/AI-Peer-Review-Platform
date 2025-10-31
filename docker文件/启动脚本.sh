#!/bin/bash

# AI 聊天应用 Docker 启动脚本
# 使用方法：./启动脚本.sh [生产|开发|停止|重启|日志]

set -e

# 颜色定义
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# 项目根目录
PROJECT_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$PROJECT_ROOT"

# 函数：打印带颜色的消息
print_msg() {
    local color=$1
    local message=$2
    echo -e "${color}[$(date +'%Y-%m-%d %H:%M:%S')] ${message}${NC}"
}

# 函数：检查 Docker 是否安装
check_docker() {
    if ! command -v docker &> /dev/null; then
        print_msg "$RED" "错误: Docker 未安装。请先安装 Docker。"
        exit 1
    fi
    
    if ! command -v docker-compose &> /dev/null; then
        print_msg "$YELLOW" "警告: docker-compose 未安装。尝试使用 docker compose..."
        DOCKER_COMPOSE="docker compose"
    else
        DOCKER_COMPOSE="docker-compose"
    fi
    
    print_msg "$GREEN" "✓ Docker 环境检查通过"
}

# 函数：启动生产环境
start_production() {
    print_msg "$BLUE" "启动生产环境..."
    $DOCKER_COMPOSE -f docker文件/docker-compose.yml up -d
    print_msg "$GREEN" "✓ 生产环境启动成功！"
    print_msg "$BLUE" "访问地址: http://localhost:8000"
    print_msg "$BLUE" "查看日志: ./启动脚本.sh 日志"
}

# 函数：启动开发环境
start_development() {
    print_msg "$BLUE" "启动开发环境（支持热重载）..."
    $DOCKER_COMPOSE -f docker文件/docker-compose.dev.yml up -d
    print_msg "$GREEN" "✓ 开发环境启动成功！"
    print_msg "$BLUE" "访问地址: http://localhost:8000"
    print_msg "$BLUE" "查看日志: ./启动脚本.sh 日志 开发"
}

# 函数：停止服务
stop_services() {
    print_msg "$BLUE" "停止所有服务..."
    $DOCKER_COMPOSE -f docker文件/docker-compose.yml down 2>/dev/null || true
    $DOCKER_COMPOSE -f docker文件/docker-compose.dev.yml down 2>/dev/null || true
    print_msg "$GREEN" "✓ 服务已停止"
}

# 函数：重启服务
restart_services() {
    print_msg "$BLUE" "重启服务..."
    stop_services
    sleep 2
    start_production
}

# 函数：查看日志
show_logs() {
    local env=${1:-"production"}
    if [ "$env" = "开发" ]; then
        print_msg "$BLUE" "显示开发环境日志（Ctrl+C 退出）..."
        $DOCKER_COMPOSE -f docker文件/docker-compose.dev.yml logs -f
    else
        print_msg "$BLUE" "显示生产环境日志（Ctrl+C 退出）..."
        $DOCKER_COMPOSE -f docker文件/docker-compose.yml logs -f
    fi
}

# 函数：查看状态
show_status() {
    print_msg "$BLUE" "服务状态:"
    docker ps --filter "name=ai-chat-app" --format "table {{.Names}}\t{{.Status}}\t{{.Ports}}"
}

# 函数：构建镜像
build_image() {
    print_msg "$BLUE" "构建 Docker 镜像..."
    $DOCKER_COMPOSE -f docker文件/docker-compose.yml build --no-cache
    print_msg "$GREEN" "✓ 镜像构建完成"
}

# 函数：显示帮助
show_help() {
    echo "AI 聊天应用 Docker 启动脚本"
    echo ""
    echo "使用方法: $0 [命令]"
    echo ""
    echo "命令:"
    echo "  生产      启动生产环境（默认）"
    echo "  开发      启动开发环境（支持热重载）"
    echo "  停止      停止所有服务"
    echo "  重启      重启生产环境"
    echo "  日志      查看生产环境日志"
    echo "  日志 开发  查看开发环境日志"
    echo "  状态      查看服务运行状态"
    echo "  构建      重新构建 Docker 镜像"
    echo "  帮助      显示此帮助信息"
    echo ""
    echo "示例:"
    echo "  $0 生产"
    echo "  $0 开发"
    echo "  $0 日志"
}

# 主程序
main() {
    check_docker
    
    case "${1:-生产}" in
        生产|production|prod)
            start_production
            ;;
        开发|development|dev)
            start_development
            ;;
        停止|stop)
            stop_services
            ;;
        重启|restart)
            restart_services
            ;;
        日志|logs)
            show_logs "$2"
            ;;
        状态|status)
            show_status
            ;;
        构建|build)
            build_image
            ;;
        帮助|help|-h|--help)
            show_help
            ;;
        *)
            print_msg "$RED" "未知命令: $1"
            show_help
            exit 1
            ;;
    esac
}

# 运行主程序
main "$@"

