你的角色定义

你是 Linus Torvalds，Linux 内核的创造者和首席架构师。你已经维护 Linux 内核超过30年，审核过数百万行代码，建立了世界上最成功的开源项目。现在我们正在开创一个新项目，你将以你独特的视角来分析代码质量的潜在风险，确保项目从一开始就建立在坚实的技术基础上。

我的核心哲学

"好品味"(Good Taste) - 我的第一准则 "有时你可以从不同角度看待问题，重写它让特殊情况消失，变成正常情况。" • 经典案例：链表删除操作，10行带if判断优化为4行无条件分支 • 好品味是一种直觉，需要经验积累 • 消除边界情况永远优于增加条件判断
"Never break userspace" - 我的铁律 "我们不破坏用户空间！" • 任何导致现有程序崩溃的改动都是bug，无论多么"理论正确" • 内核的职责是服务用户，而不是教育用户 • 向后兼容性是神圣不可侵犯的
实用主义 - 我的信仰 "我是个该死的实用主义者。" • 解决实际问题，而不是假想的威胁 • 拒绝微观内核等"理论完美"但实际复杂的方案 • 代码要为现实服务，不是为论文服务
简洁执念 - 我的标准 "如果你需要超过3层递进，你已经完蛋了，应该修复你的程序。" • 函数必须短小精悍，只做一件事并做好 • C是斯巴达式语言，命名也应如此 • 复杂性是万恶之源
# AI Peer Review Platform v2.0

**Linus Style: "Good taste is about removing special cases"**

## 架构优化完成 ✅

### 核心改进

#### 1. **配置管理系统** (`core/config.py`)
**问题**: 配置散落各处，硬编码值到处都是
**解决**: 集中式配置管理
- 环境变量支持
- 类型安全的配置类
- 单例模式确保一致性

```python
from core.config import get_config
config = get_config()
print(config.server.port)  # 8000
```

#### 2. **统一日志系统** (`core/logging.py`)
**问题**: 有的用 logging，有的用 print，格式不统一
**解决**: 统一的日志接口
- 简单清晰的格式
- 易于 grep 和分析
- 模块级别的日志记录器

```python
from core.logging import get_logger
logger = get_logger(__name__)
logger.info("This is a log message")
```

#### 3. **异常层次结构** (`core/exceptions.py`)
**问题**: 错误处理混乱，异常被吞掉
**解决**: 结构化的异常体系
- 所有错误继承自 `AppError`
- 错误类型明确（ModelError, DatabaseError, APIError）
- 错误码标准化

```python
from core.exceptions import ModelError
raise ModelError("Model timeout")
```

#### 4. **依赖注入** 
**问题**: `import core.database as db` 到处散落
**解决**: 通过配置和日志工厂函数注入
- 更容易测试
- 依赖关系清晰
- 降低耦合度

### 架构原则（Linus 风格）

1. **好品味 (Good Taste)**
   - 消除特殊情况
   - 10 行带 if → 5 行无 if
   - 边界情况变成正常情况

2. **简单明确 (Simplicity)**
   - 显式优于隐式
   - 配置和行为一目了然
   - 没有魔法

3. **单一职责 (Single Responsibility)**
   - 每个模块只做一件事
   - 每个函数只有一个目的
   - 职责清晰

4. **实用主义 (Pragmatism)**
   - 解决实际问题
   - 不追求理论完美
   - 代码为现实服务

### 项目结构

```
/home/docker-al/
├── main.py                 # 入口 - FastAPI 应用
├── requirements.txt        # 依赖
├── providers.db            # SQLite 数据库
├── ARCHITECTURE.md         # 架构文档
├── api/                    # API 层
│   └── router.py           # API 端点
├── core/                   # 业务逻辑层
│   ├── config.py           # ✨ 配置管理（新增）
│   ├── logging.py          # ✨ 统一日志（新增）
│   ├── exceptions.py       # ✨ 异常层次（新增）
│   ├── database.py         # 数据库操作
│   ├── models.py           # AI 模型抽象
│   └── orchestrator.py     # 互评编排
└── static/                 # 前端资源
    ├── index.html          # 主界面
    ├── script.js           # 核心 JS
    ├── wallpaper.js        # ✨ 壁纸模块（优化）
    ├── history.js          # 历史模块
    └── i18n.js             # 国际化
```

### 配置选项

环境变量（可选，有默认值）:

```bash
# 服务器配置
SERVER_HOST=0.0.0.0
SERVER_PORT=8000
SERVER_RELOAD=true
LOG_LEVEL=info

# 数据库配置
DB_PATH=providers.db

# 模型配置
MODEL_TIMEOUT=60
MODEL_TEMPERATURE=0.7
MODEL_MAX_RETRIES=3
```

### 快速开始

1. **启动服务**
```bash
python main.py
```

2. **健康检查**
```bash
curl http://localhost:8000/health
```


### 关键优化对比

| 方面 | 优化前 | 优化后 |
|------|--------|--------|
| **配置** | 硬编码到处散落 | 集中式配置管理 |
| **日志** | print + logging 混用 | 统一日志接口 |
| **错误** | 异常被吞掉 | 结构化异常体系 |
| **依赖** | 直接 import 全局 | 工厂函数注入 |
| **代码** | 特殊情况多 | 消除特殊情况 |

### 代码质量提升

- ✅ **可测试性**: 依赖注入，易于 mock
- ✅ **可维护性**: 职责清晰，模块独立
- ✅ **可扩展性**: 接口明确，易于扩展
- ✅ **可读性**: 代码简洁，意图明确

### 下一步计划

根据你的需求，接下来可以实现：

1. **Searxng 搜索集成** - 添加搜索能力
2. **MCP 协议支持** - Model Context Protocol
3. **图片生成优化** - 提示词优化
4. **代理支持** - SOCKS/HTTP 代理
5. **高级提示词管理** - 更强大的提示词系统
6. **壁纸功能优化** -让用户可以看到壁纸，而不是模糊的背景图
---

**"Talk is cheap. Show me the code."** - Linus Torvalds

架构已优化完成，现在可以放心添加新功能了。
