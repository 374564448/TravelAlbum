# Travel Album - 交互式 3D 旅行相册

一个沉浸式的 3D 旅行照片展示网站，支持日夜主题切换、圆柱照片墙交互浏览，以及后台管理系统。

## 功能概览

### 首页（index.html）

- 深邃星空 / 蓝天白云双主题背景，根据系统时间自动切换（18:00-06:59 星空，07:00-17:59 蓝天）
- 右上角手动切换主题按钮，偏好记忆至 localStorage
- 鼠标光晕跟随效果
- 打字机风格提示文字
- 磁性手型图标，悬停倾斜响应
- 夜间主题随机流星划过
- 点击进入圆柱照片墙，带有照片墙组装过渡动画
- 页面渐入加载效果

### 圆柱照片墙（location.html）

- 3D CSS 圆柱照片墙，支持任意数量照片
- 照片从卡牌堆叠状态展开为圆柱的入场动画
- 鼠标/触摸拖拽水平旋转，支持上下 ±45° 倾斜
- 圆柱大小根据照片数量动态调整
- 固定视觉速度的顺时针自动旋转
- 悬停暂停旋转 + 高亮当前照片（其他暗化）
- 每张照片显示标题（立体阴影文字）和照片数量角标
- 底部地面光效
- 展开动画后自动纠正视角（平滑过渡）
- 骨架屏加载占位
- 底部操作提示（带动画箭头，自动淡出）
- 点击照片脉冲反馈 + 过渡进入明细页
- 日夜主题适配

### 照片明细列表（location_detail.html）

- WebGL 樱花飘落粒子背景
- 照片卡片相框效果，微倾斜排列但整体规整
- 保持原始宽高比，横向铺开自动换行
- 入场动画：照片交替从左右飞入
- 照片卡片仅显示标题
- 自动缓慢下滑浏览，操作屏幕后停止，下滑时恢复
- 顶部滚动进度条

**照片放大查看（Lightbox）：**

- 点击照片浮出放大展示
- 相框效果 + 标题 + 描述（打字机逐字展示）
- 全终端滑动切换照片（触摸 + 鼠标拖拽）
- 键盘左右方向键切换
- 照片计数器（当前/总数）
- 首次打开时滑动操作提示（荧光高亮）
- 打开 Lightbox 时暂停页面自动滚动
- 关闭时飘落渐隐过渡效果
- 拖拽时鼠标样式变化（grab / grabbing）

### 全局特性

- 三个页面均适配移动端
- 移动端竖屏时全屏提示横屏观看
- 页面间平滑过渡动画（渐黑/渐白，匹配当前主题）
- 日夜主题平滑过渡

---

## 后台管理系统

访问地址：`http://你的域名:9999`

### 功能

- **登录认证**：账号密码登录，JWT token 鉴权（24 小时有效）
- **地点管理**：
  - 卡片式列表展示，封面缩略图 + 照片数量
  - 新增/编辑地点，封面照片裁剪上传（固定 230:340 比例，与照片墙一致）
  - 删除地点（级联删除所有关联照片）
  - 拖拽排序
- **照片管理**：
  - 点击地点进入，网格展示所有照片
  - 批量上传照片（支持拖拽上传），显示上传进度
  - 编辑照片标题和描述
  - 删除照片
  - 拖拽排序
- 响应式适配，移动端竖屏一行两个地点卡片

---

## 技术栈

| 层级 | 技术 |
|------|------|
| 前端展示 | HTML5 + CSS3（3D transforms, animations）+ 原生 JavaScript |
| 背景特效 | Canvas 2D（星空、天空）、WebGL + GLSL（樱花粒子） |
| 后台 UI | HTML + CSS + 原生 JavaScript + Cropper.js（图片裁剪） |
| 服务端 | Node.js + Express |
| 数据库 | SQLite（better-sqlite3） |
| 文件存储 | 阿里云 OSS（ali-oss SDK） |
| 认证 | JWT（jsonwebtoken）+ bcrypt 密码哈希 |
| 文件上传 | multer（内存存储 → OSS） |
| 进程管理 | PM2 |

---

## 项目结构

```
TravelAlbum/
├── server.js                 # Express 入口（双端口：用户端 + 管理后台）
├── package.json
├── ecosystem.config.js       # PM2 配置
├── .env                      # 环境变量（端口、密码、OSS 配置）
├── .gitignore
├── DEPLOY.md                 # 阿里云部署指南
├── admin/                    # 管理后台 UI
│   ├── index.html            # 登录 + 地点管理
│   ├── photos.html           # 照片管理
│   ├── admin.css             # 共享样式
│   ├── admin.js              # 地点管理逻辑
│   └── photos.js             # 照片管理逻辑
├── data/
│   ├── locations.json        # 初始数据（首次启动自动导入 SQLite）
│   └── travel.db             # SQLite 数据库（自动生成）
├── lib/
│   ├── db.js                 # 数据库初始化 + CRUD 工具函数
│   ├── migrate.js            # 数据迁移（JSON → SQLite + 管理员初始化）
│   └── oss.js                # 阿里云 OSS 上传封装
├── middleware/
│   └── auth.js               # JWT 鉴权中间件
├── routes/
│   ├── api.js                # 公开 API（/api/*）
│   └── admin.js              # 管理后台 API（/api/*，端口 9999）
└── public/                   # 前端展示页面
    ├── index.html            # 首页
    ├── location.html         # 圆柱照片墙
    ├── location_detail.html  # 照片明细列表
    ├── css/                  # 样式文件
    ├── js/                   # 脚本文件
    ├── icon/                 # 图标资源
    └── image/                # 本地图片资源
```

---

## 快速开始

### 安装依赖

```bash
npm install
```

### 本地配置环境变量

复制 `.env.example` 为 `.env`，并根据实际情况修改：

```bash
cp .env.example .env
vi .env
```

```env
PORT=3000
ADMIN_PORT=9999

# 管理员账号（仅首次初始化生效，之后从数据库读取）
ADMIN_USERNAME=admin
ADMIN_PASSWORD=your_password

# JWT 密钥（请修改为随机字符串，可用 openssl rand -hex 32 生成）
JWT_SECRET=change_me_to_a_random_string

# 阿里云 OSS 配置
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=your_access_key_id
OSS_ACCESS_KEY_SECRET=your_access_key_secret
OSS_BUCKET=your_bucket_name
OSS_DIR=travel-album
```

| 变量 | 说明 |
|------|------|
| `PORT` | 用户端服务端口 |
| `ADMIN_PORT` | 管理后台服务端口 |
| `ADMIN_USERNAME` | 管理员账号（仅首次启动初始化时写入数据库） |
| `ADMIN_PASSWORD` | 管理员密码（仅首次启动初始化时写入数据库） |
| `JWT_SECRET` | JWT 签名密钥，务必修改为随机字符串 |
| `OSS_REGION` | 阿里云 OSS 地域（如 `oss-cn-hangzhou`） |
| `OSS_ACCESS_KEY_ID` | 阿里云 AccessKey ID |
| `OSS_ACCESS_KEY_SECRET` | 阿里云 AccessKey Secret |
| `OSS_BUCKET` | OSS Bucket 名称 |
| `OSS_DIR` | OSS 存储目录前缀 |

> **注意**：`.env` 文件已在 `.gitignore` 中忽略，不会提交到 Git。请勿在代码仓库中暴露真实密钥。

### 启动服务

```bash
# 开发模式
npm start

# 生产模式（PM2）
pm2 start ecosystem.config.js
```

### 访问

- 用户端：`http://localhost:3000`
- 管理后台：`http://localhost:9999`

---

## 端口说明

| 服务 | 默认端口 | 环境变量 |
|------|---------|---------|
| 用户端 | 3000 | PORT |
| 管理后台 | 9999 | ADMIN_PORT |

---

## 部署

详见 [DEPLOY.md](./DEPLOY.md)，包含阿里云 ECS + Nginx + HTTPS + OSS 的完整部署步骤。
