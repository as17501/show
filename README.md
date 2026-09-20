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
├── sources/
│   └── apple-explorer/        # 苹果开发工程：TS / Three.js / 测试 / 锁文件
├── scripts/
│   └── build-projects.cjs     # 构建、验证并同步苹果发布包
├── projects/
│   ├── apple-explorer/        # 自动生成，禁止直接修改
│   └── freeform-breaker/      # 无需构建，直接维护 HTML / CSS / JS
├── tests/                     # 浏览器集成测试、游戏引擎测试
├── package.json               # 仅开发和测试使用，不参与网站运行
├── package-lock.json
└── .nojekyll                  # 按普通静态文件提供服务
```

苹果演示的源码、依赖锁文件、开发说明、参考截图和完整测试已纳入 `sources/apple-explorer/`，不再依赖仓库外的旧工程。原目录保留为备份，后续不要在两处同时修改。`node_modules`、临时 `dist` 和测试截图不提交。

- **需构建的项目**：在 `sources/<项目>/` 维护源码，在 `projects/<项目>/` 提交构建结果。
- **原生静态项目**：直接在 `projects/<项目>/` 维护，不复制出第二份源码。
- 苹果发布目录的全部内容由构建脚本管理，包括许可证和部署说明；这些附属文件的源头在 `sources/apple-explorer/public/`。
- 苹果返回入口写在源 HTML 中，样式直接引用根目录 `assets/project-nav.css`，图标引用根目录 `assets/favicon.svg`，由 Vite 一起打包。重新构建不会丢失导航。

## 日常开发与迭代

首次克隆后，在仓库根目录执行（Node.js 22.12+，或符合 Vite 7 要求的受支持版本）：

```bash
npm run setup                         # 安装根目录和苹果工程各自锁定的依赖
npx playwright install chromium
cd sources/apple-explorer
npx playwright install chromium       # 两套测试版本可能不同，分别准备浏览器
cd ../..
```

两份锁文件各自保留，避免迁移时顺带升级框架。单独执行根目录 `npm ci` 不会安装苹果依赖，请使用 `npm run setup`。

### 修改苹果演示

编辑 `sources/apple-explorer/src/` 和源 `index.html`，运行：

```bash
npm run dev:apple                     # Vite 开发预览，地址以终端输出为准
npm run verify                        # 构建同步 → 全部测试 → 再次构建并比较产物
```

Vite 独立开发预览仅用于苹果页面，根目录不是导航首页；测试“返回作品集”和真实子路径时，构建后从仓库根目录 `npm start` 进入完整站点。

### 修改打砖块 / 导航首页

直接修改 `projects/freeform-breaker/` 或首页文件，使用 `npm start` 查看完整站点，并运行 `npm run verify`。打砖块的游戏规则和文件职责见其目录中的 `README.md`。

### 构建命令

| 命令 | 用途 |
| --- | --- |
| `npm run build` | 构建苹果工程，通过资源与导航检查后，替换对应发布目录并移除旧哈希文件 |
| `npm run build:check` | 重新构建，但不修改发布目录；逐文件比较，发现漏同步或手改产物则失败 |
| `npm run test:apple` | 苹果源码交互、几何和移动端测试 |
| `npm run test:site` | 游戏引擎及完整发布站点浏览器回归 |
| `npm test` | 构建脚本测试 + 苹果源码测试 + 站点测试（不自动同步发布包） |
| `npm run verify` | 发布前完整验证，自动同步构建结果 |

构建失败不会覆盖当前发布包。`npm run build` 不会改动打砖块和其他项目；不要在苹果生成目录中放需要手工保留的文件。

验证成功后，检查改动，再将源码和产物**一起提交**：

```bash
git status
git diff --stat
git add .
git commit -m "更新苹果演示"
git push origin main
```

命令不会代替你自动提交或推送。当前仍按分支根目录发布，GitHub 不会替你运行本地构建脚本；只推送源码不会更新苹果演示的运行内容。

## 添加新作品

### 1. 放入一个独立文件夹

例如新项目叫计时器，放在 `projects/timer/`：

```text
projects/timer/
├── index.html
├── style.css
└── script.js
```

如果使用前端框架，将开发工程放进 `sources/<项目>/`，将**构建产物**放进 `projects/<项目>/`。同时扩展构建脚本和对应测试；目前构建脚本只管理苹果演示，不会自动发现新工程。资源路径应使用 `./style.css` 等相对路径，避免 `/assets/...` 这样的域名根路径；构建时也应配置适合子目录的资源路径。

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

Node.js 用于本地构建和测试，Playwright 用于测试；网站访问时不依赖它们，不需要上传 `node_modules`。

```bash
npm run setup
npx playwright install chromium
(cd sources/apple-explorer && npx playwright install chromium)
npm run verify
```

测试包括：

- 构建脚本的目录替换、旧文件清理、失败保留、过期产物检查；
- 苹果源码原有的交互、动画中断、种子裁切、体积守恒等测试，以及返回入口检查；

- 打砖块原有的 23 项引擎测试；
- 首页卡片、图片、分类数量、筛选、搜索、空状态、键盘搜索快捷键、随机入口；
- `/` 和 `/show/` 下实际点击进入两个项目，再返回首页；
- 苹果 WebGL 初始化、横切、横截面、种子观察、重置；
- 游戏启动、暂停、继续和移动端触屏控制；
- 1440 / 768 / 390 / 320 像素宽度下的三个页面布局；
- 关闭 JavaScript 时的首页导航降级；
- 浏览器错误、缺失资源和站点运行时外部网络请求检查。

测试自动启动临时 HTTP 服务，无需提前运行本地预览。截图输出到被 Git 忽略的 `test-results/`。

苹果源码测试使用独立的 `5188` 端口，如端口被占用会明确失败而不复用未知服务。源码测试截图在 `sources/apple-explorer/test-results/`；站点截图在根目录 `test-results/`。

当前仓库和分支根目录站点均是公开的；`sources/` 是目录组织，不是访问权限隔离。源码中同样不能保存密钥或私密数据。
