require('dotenv').config();

const express = require('express');
const path = require('path');
const migrate = require('./lib/migrate');

const PORT = process.env.PORT || 3000;
const ADMIN_PORT = process.env.ADMIN_PORT || 9999;

// ===== 数据迁移（启动前执行） =====
migrate();

// ===== 用户端应用 =====
const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const apiRoutes = require('./routes/api');
app.use('/api', apiRoutes);

app.listen(PORT, () => {
  console.log(`用户端已启动: http://localhost:${PORT}`);
});

// ===== 管理后台应用 =====
const adminApp = express();
adminApp.use(express.json());
adminApp.use(express.static(path.join(__dirname, 'admin')));

const adminRoutes = require('./routes/admin');
adminApp.use('/api', adminRoutes);

adminApp.listen(ADMIN_PORT, () => {
  console.log(`管理后台已启动: http://localhost:${ADMIN_PORT}`);
});
