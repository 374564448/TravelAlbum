# Travel Album 阿里云部署指南

## 一、服务器准备

### 1.1 购买 ECS 实例

- 进入 [阿里云 ECS 控制台](https://ecs.console.aliyun.com/) 创建实例
- 推荐配置：2 核 2G 以上，系统选 **Ubuntu 22.04 LTS** 或 **CentOS 8**
- 安全组放通以下端口：
  - `80`（用户端 HTTP）
  - `443`（用户端 HTTPS，可选）
  - `9999`（管理后台）
  - `22`（SSH 登录）

### 1.2 SSH 登录服务器

```bash
ssh root@你的服务器公网IP
```

### 1.3 安装 Node.js

```bash
# 安装 nvm
curl -o- https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.0/install.sh | bash
source ~/.bashrc

# 安装 Node.js（推荐 18 LTS）
nvm install 18
nvm use 18
node -v  # 确认版本
```

### 1.4 安装 PM2（进程管理器）

```bash
npm install -g pm2
```

### 1.5 安装 Nginx

```bash
# Ubuntu
sudo apt update && sudo apt install nginx -y

# CentOS
sudo yum install nginx -y

# 启动并设置开机自启
sudo systemctl start nginx
sudo systemctl enable nginx
```

### 1.6 安装编译工具（better-sqlite3 需要）

```bash
# Ubuntu
sudo apt install build-essential python3 -y

# CentOS
sudo yum groupinstall "Development Tools" -y
sudo yum install python3 -y
```

---

## 二、项目部署

### 2.1 上传项目到服务器

```bash
# 方式一：通过 Git（推荐）
cd /opt
git clone 你的仓库地址 travel-album
cd travel-album

# 方式二：通过 scp 本地上传
scp -r ./TravelAlbum root@你的服务器IP:/opt/travel-album
```

### 2.2 安装依赖

```bash
cd /opt/travel-album
npm install --production
```

### 2.3 配置环境变量

```bash
cp .env .env.backup  # 备份默认配置
vi .env
```

修改 `.env` 文件内容：

```env
PORT=3000
ADMIN_PORT=9999

# 管理员账号（仅首次初始化生效，之后从数据库读取）
ADMIN_USERNAME=你的管理员账号
ADMIN_PASSWORD=你的管理员密码

# JWT 密钥（务必修改为随机字符串！）
JWT_SECRET=修改为一个随机的长字符串

# 阿里云 OSS 配置（见下方第三节）
OSS_REGION=oss-cn-hangzhou
OSS_ACCESS_KEY_ID=你的AccessKeyId
OSS_ACCESS_KEY_SECRET=你的AccessKeySecret
OSS_BUCKET=你的Bucket名称
OSS_DIR=travel-album
```

> **重要**：`JWT_SECRET` 请修改为一个随机字符串（如 `openssl rand -hex 32` 生成），不要使用默认值。

### 2.4 首次启动（验证）

```bash
node server.js
```

看到以下输出说明启动成功：

```
管理员账号已初始化：xxx
数据迁移完成：导入 x 个地点
用户端已启动: http://localhost:3000
管理后台已启动: http://localhost:9999
```

按 `Ctrl+C` 停止，接下来使用 PM2 后台运行。

### 2.5 使用 PM2 后台运行

```bash
cd /opt/travel-album

# 启动
pm2 start ecosystem.config.js

# 查看运行状态
pm2 status

# 查看日志
pm2 logs travel-album

# 设置开机自启
pm2 save
pm2 startup
# 按照提示执行输出的命令
```

**PM2 常用命令：**

```bash
pm2 restart travel-album   # 重启
pm2 stop travel-album      # 停止
pm2 delete travel-album    # 删除
pm2 logs travel-album      # 查看日志
pm2 monit                  # 实时监控
```

---

## 三、阿里云 OSS 配置

### 3.1 创建 Bucket

1. 进入 [OSS 控制台](https://oss.console.aliyun.com/)
2. 点击「创建 Bucket」
   - **Bucket 名称**：如 `travel-album-photos`
   - **地域**：选择与 ECS 相同的地域（如 `华东1（杭州）`，对应 `oss-cn-hangzhou`）
   - **存储类型**：标准存储
   - **读写权限**：**公共读**（图片需要被前端直接访问）
3. 创建完成

### 3.2 获取 AccessKey

1. 进入 [AccessKey 管理](https://ram.console.aliyun.com/manage/ak)
2. 推荐创建 RAM 子账号，仅授予 OSS 权限（更安全）：
   - 进入 [RAM 控制台](https://ram.console.aliyun.com/) → 用户 → 创建用户
   - 勾选「OpenAPI 调用访问」
   - 添加权限：`AliyunOSSFullAccess`
   - 记录 **AccessKey ID** 和 **AccessKey Secret**

### 3.3 填写配置

将获取的信息填入 `.env` 文件：

```env
OSS_REGION=oss-cn-hangzhou        # 替换为你 Bucket 所在地域
OSS_ACCESS_KEY_ID=LTAI5t...       # 替换为你的 AccessKey ID
OSS_ACCESS_KEY_SECRET=Gx7k...     # 替换为你的 AccessKey Secret
OSS_BUCKET=travel-album-photos    # 替换为你的 Bucket 名称
OSS_DIR=travel-album              # OSS 内存储目录前缀
```

### 3.4 OSS 跨域配置（CORS）

如果前端直接访问 OSS 图片出现跨域问题：

1. 进入 OSS 控制台 → 你的 Bucket → 数据安全 → 跨域设置
2. 添加规则：
   - **来源**：`*`（或填你的域名）
   - **允许 Methods**：`GET`
   - **允许 Headers**：`*`
   - **缓存时间**：`3600`

---

## 四、域名与 Nginx 配置

### 4.1 域名解析

在域名服务商（如阿里云域名控制台）添加 A 记录：

| 记录类型 | 主机记录 | 记录值 |
|---------|---------|--------|
| A | travel（或你想要的子域名） | 你的 ECS 公网 IP |

### 4.2 Nginx 配置

```bash
sudo vi /etc/nginx/conf.d/travel-album.conf
```

写入以下内容（替换 `travel.example.com` 为你的真实域名）：

```nginx
# ===== OSS 图片缓存区（放在 http {} 块内，编辑 /etc/nginx/nginx.conf 添加） =====
# proxy_cache_path /var/cache/nginx/oss_images
#     levels=1:2
#     keys_zone=oss_cache:10m
#     max_size=2g
#     inactive=60m
#     use_temp_path=off;

# ===== 用户端 =====
server {
    listen 80;
    server_name travel.example.com;

    location / {
        proxy_pass http://127.0.0.1:3000;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }

    # 可选：OSS 图片代理缓存（取消注释启用）
    # 启用前需先在 nginx.conf 的 http {} 块中添加上方的 proxy_cache_path
    # location /oss/ {
    #     proxy_pass https://你的Bucket.oss-cn-hangzhou.aliyuncs.com/;
    #     proxy_cache oss_cache;
    #     proxy_cache_valid 200 30m;
    #     proxy_cache_valid 404 1m;
    #     proxy_cache_key $uri;
    #     proxy_cache_use_stale error timeout updating;
    #     add_header X-Cache-Status $upstream_cache_status;
    #     add_header Cache-Control "public, max-age=1800";
    #     proxy_connect_timeout 10s;
    #     proxy_read_timeout 30s;
    # }
}

# ===== 管理后台 =====
server {
    listen 9999;
    server_name travel.example.com;

    client_max_body_size 20m;

    location / {
        proxy_pass http://127.0.0.1:9999;
        proxy_set_header Host $host;
        proxy_set_header X-Real-IP $remote_addr;
        proxy_set_header X-Forwarded-For $proxy_add_x_forwarded_for;
        proxy_set_header X-Forwarded-Proto $scheme;
    }
}
```

### 4.3 验证并重载 Nginx

```bash
# 检查配置语法
sudo nginx -t

# 重载配置
sudo systemctl reload nginx
```

### 4.4 配置 HTTPS（推荐）

```bash
# 安装 certbot
sudo apt install certbot python3-certbot-nginx -y   # Ubuntu
# sudo yum install certbot python3-certbot-nginx -y  # CentOS

# 自动申请 SSL 证书并配置
sudo certbot --nginx -d travel.example.com

# 证书自动续期（certbot 会自动添加定时任务）
sudo certbot renew --dry-run
```

> 注意：管理后台端口 9999 如果也需要 HTTPS，需要单独为该 server 块配置证书，或者改为统一走 443 端口用路径区分。

---

## 五、数据备份

### 5.1 数据库备份

SQLite 数据库文件位于 `data/travel.db`，建议定期备份：

```bash
# 手动备份
cp /opt/travel-album/data/travel.db /opt/travel-album/data/travel.db.bak.$(date +%Y%m%d)

# 定时备份（每天凌晨 3 点）
crontab -e
# 添加以下行：
0 3 * * * cp /opt/travel-album/data/travel.db /opt/backup/travel.db.$(date +\%Y\%m\%d)
```

### 5.2 OSS 数据

OSS 本身有数据冗余机制，一般无需额外备份。如需跨地域备份，可在 OSS 控制台开启「跨区域复制」。

---

## 六、常见问题

### Q: better-sqlite3 安装失败？

需要编译环境，确保已安装：

```bash
sudo apt install build-essential python3 -y  # Ubuntu
```

如果仍失败，尝试：

```bash
npm install --build-from-source better-sqlite3
```

### Q: 端口被占用？

```bash
# 查看占用端口的进程
lsof -i:3000
lsof -i:9999

# 杀掉进程
kill -9 进程PID
```

### Q: 如何查看服务日志？

```bash
pm2 logs travel-album          # 实时日志
pm2 logs travel-album --lines 100  # 最近 100 行
```

### Q: 如何更新项目代码？

```bash
cd /opt/travel-album
git pull                        # 拉取最新代码
npm install --production        # 更新依赖（如有变动）
pm2 restart travel-album        # 重启服务
```

### Q: 如何重置管理员密码？

修改 `.env` 中的 `ADMIN_PASSWORD`，然后删除数据库中的管理员记录：

```bash
cd /opt/travel-album
node -e "
  const db = require('./lib/db');
  const bcrypt = require('bcryptjs');
  require('dotenv').config();
  const hash = bcrypt.hashSync(process.env.ADMIN_PASSWORD, 10);
  db.db.prepare('UPDATE admins SET password_hash = ? WHERE username = ?').run(hash, process.env.ADMIN_USERNAME);
  console.log('密码已重置');
"
```

---

## 七、项目端口一览

| 服务 | 内部端口 | 外部端口（Nginx） | 说明 |
|------|---------|-------------------|------|
| 用户端 | 3000 | 80 / 443 | 前端展示页面 |
| 管理后台 | 9999 | 9999 | 后台管理系统 |
| SQLite | - | - | 本地文件数据库 |
| 阿里云 OSS | - | - | 图片存储 |
