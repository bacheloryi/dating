# 拼豆图纸生成器

把照片转换成 MARD 291 色拼豆图纸，支持 50×50 多板拼接。

## 本地使用

```bash
# 在仓库根目录启动静态服务后打开 bean.html
npx --yes serve .
# 打开 http://localhost:3000/bean.html
```

## 功能

- 上传照片，本地处理，不上传服务器
- 按板数裁剪（每板 50×50 粒）
- MARD 291 色 CIE Lab 最近色匹配
- 色号清单与用量统计
- 导出整图 PNG / 按板分页导出

## 发布到 GitHub Pages

将 `bead-pattern/` 目录内容推送到 `zoe` 仓库的 `bead-pattern` 分支根目录，并在仓库 Settings → Pages 中选择该分支作为来源。

访问地址：`https://bacheloryi.github.io/zoe/bean.html`

## 色卡说明

内置 MARD 291 色 HEX 参考值（A–H、M 标准 221 色 + P/Q/R/T/Y/ZG 扩展 70 色）。屏幕颜色与实物拼豆可能有差异，购买材料请以官方色卡为准。
