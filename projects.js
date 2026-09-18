/* 新增作品：将静态文件放入 projects/<目录>/，然后在下面增加一条配置。
 * category 可选 demo（互动演示）、game（小游戏）、tool（小工具）。
 * 链接和图片均使用相对路径，以兼容 GitHub Pages 的 /show/ 子路径。
 */
window.SHOW_PROJECTS = [
  {
    id: 'apple-explorer',
    title: '苹果里面有什么？',
    subtitle: 'APPLE EXPLORER',
    description: '转一转，切一刀。用一颗 3D 苹果，发现果皮、果肉和种子里的小秘密。',
    category: 'demo',
    tags: ['3D 互动', '自然观察', '教学演示'],
    href: './projects/apple-explorer/',
    image: './assets/previews/apple-explorer.jpg',
    imageAlt: '切开后的三维苹果，可以看到果肉与中心的种子',
    theme: 'apple',
    action: '开始探索',
    note: '给好奇心的一堂小课',
  },
  {
    id: 'freeform-breaker',
    title: '自由反弹',
    subtitle: 'FREEFORM BREAKER',
    description: '别只守在底线。在整个场地自由移动挡板，接住小球，把眼前的砖块一一击破。',
    category: 'game',
    tags: ['打砖块', '随机补给', '鼠标 / 触屏'],
    href: './projects/freeform-breaker/',
    image: './assets/previews/freeform-breaker.jpg',
    imageAlt: '深色游戏场地中的彩色砖块、小球与自由移动的挡板',
    theme: 'breaker',
    action: '来玩一局',
    note: '给自己几分钟放空',
  },
];
