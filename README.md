# SHOW · 小小作品集

一个持续生长的静态作品集，收集自己做的小游戏、小工具和互动演示。

**运行站点不需要 Node.js、构建步骤、服务器后端或第三方 CDN。** 首页和作品均为静态文件；苹果演示通过 HTTP / HTTPS 访问，浏览器需要支持 WebGL 2。

## 已收录

| 作品 | 分类 | 入口 |
| --- | --- | --- |
| 苹果里面有什么？ | 互动演示 | `projects/apple-explorer/index.html` |
| 自由反弹 | 小游戏 | `projects/freeform-breaker/index.html` |

首页提供分类筛选、关键词搜索、随机打开一个作品。点击卡片进入作品，每个作品顶部都有返回作品集的入口。没有 JavaScript 时，首页仍显示两个初始作品的直接链接（作品本身需要 JavaScript）。

## 本地预览

在仓库目录执行：

```bash
python3 -m http.server 4173 --bind 127.0.0.1
```

浏览器打开 `http://127.0.0.1:4173/`。不要以双击 HTML 的方式验证苹果演示，浏览器的本地模块限制会影响加载。

## 目录约定

```text
show/
├── index.html                 # 导航首页
├── projects.js                # 作品清单：新增作品主要改这里
├── assets/
│   ├── site.css               # 首页样式、响应式布局
│   ├── site.js                # 筛选、搜索、卡片渲染
│   ├── project-nav.css        # 子项目共用的返回入口样式
│   ├── favicon.svg
│   └── previews/              # 首页使用的作品真实预览图
├── projects/
│   ├── apple-explorer/        # 苹果演示静态发布包
│   └── freeform-breaker/      # 打砖块静态发布包
├── tests/                     # 浏览器集成测试、游戏引擎测试
├── package.json               # 仅开发和测试使用，不参与网站运行
├── package-lock.json
└── .nojekyll                  # 按普通静态文件提供服务
```

开发源码、node_modules、旧的截图和 ZIP 备份没有一起搬进此仓库。苹果演示是已经构建的发布包，日后如需修改其逻辑，应在原开发项目里修改、重新构建，再替换此处的 `assets` 和页面，并保留返回入口。打砖块的 HTML / CSS / JS 则可以直接编辑。

## 添加新作品

### 1. 放入一个独立文件夹

例如新项目叫计时器，放在 `projects/timer/`：

```text
projects/timer/
├── index.html
├── style.css
└── script.js
```

如果使用前端框架，将**构建产物**放进文件夹，而不是仅放框架源码。资源路径应使用 `./style.css` 等相对路径，避免 `/assets/...` 这样的域名根路径；构建时也应配置适合子目录的资源路径。

### 2. 添加一张预览图

保存到 `assets/previews/timer.jpg`，建议横向 1000 × 550 像素。可以使用 PNG / JPG / WebP。不要放入包含密钥、个人隐私或调试数据的截图。

### 3. 在 `projects.js` 数组里追加一条记录

```javascript
{
  id: 'timer',                          // 唯一标识，建议与文件夹同名
  title: '专注计时器',
  subtitle: 'FOCUS TIMER',
  description: '给眼前的事，留一段不被打扰的时间。',
  category: 'tool',                     // demo / game / tool
  tags: ['计时', '专注'],
  href: './projects/timer/',
  image: './assets/previews/timer.jpg',
  imageAlt: '计时器的主界面',
  theme: 'default',                     // default / apple / breaker
  action: '开始专注',
  note: '把注意力交还给自己',
},
```

列表顺序就是首页展示顺序；作品总数、分类数量、搜索和随机入口自动更新，不需要再改首页 HTML。`id` 必须唯一。为了照顾关闭 JavaScript 的访问者，可以同时在 `index.html` 的 `<noscript>` 中补充新作品链接。

### 4. 为新项目添加返回入口（推荐）

在作品的 `<head>` 加入：

```html
<link rel="stylesheet" href="../../assets/project-nav.css">
<link rel="icon" href="../../assets/favicon.svg" type="image/svg+xml">
```

在 `<body>` 开始处加入：

```html
<nav class="show-project-nav" aria-label="作品集导航">
  <a href="../../">← 返回小小作品集</a>
  <span>SHOW / 保持好奇，慢慢创造。</span>
</nav>
```

## GitHub Pages 发布

首次将代码推送到 GitHub 的 `main` 分支后，在仓库设置中启用 Pages：

1. 打开仓库 **Settings → Pages**。
2. 在 **Build and deployment → Source** 选择 **Deploy from a branch**。
3. 选择 **main** 分支、**/(root)**，保存。
4. 等部署成功后，使用 Pages 设置页给出的地址。

Pages 启用并部署成功后的访问地址是 `https://as17501.github.io/show/`。之后推送到 `main` 会更新站点；首次是否已启用以及最新部署状态，以仓库 Pages 设置页为准。

仓库根目录已经有 `.nojekyll`，没有构建工作流要求；所有本地资源和返回入口均使用相对路径，并在 `/` 与 `/show/` 两种挂载路径下做了测试。网站会公开提供静态文件，请勿提交 SSH 私钥、密码、私密 API Key 或其他敏感内容。

## 自动化验证

Node.js 和 Playwright 仅用于测试，不需要上传 `node_modules`。

```bash
npm ci
npx playwright install chromium
npm test
```

测试包括：

- 打砖块原有的 23 项引擎测试；
- 首页卡片、图片、分类数量、筛选、搜索、空状态、键盘搜索快捷键、随机入口；
- `/` 和 `/show/` 下实际点击进入两个项目，再返回首页；
- 苹果 WebGL 初始化、横切、横截面、种子观察、重置；
- 游戏启动、暂停、继续和移动端触屏控制；
- 1440 / 768 / 390 / 320 像素宽度下的三个页面布局；
- 关闭 JavaScript 时的首页导航降级；
- 浏览器错误、缺失资源和站点运行时外部网络请求检查。

测试自动启动临时 HTTP 服务，无需提前运行本地预览。截图输出到被 Git 忽略的 `test-results/`。
