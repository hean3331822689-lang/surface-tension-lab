# 永久部署说明

当前网站是纯静态网页，可以部署到 GitHub Pages、Vercel、Netlify、Cloudflare Pages 等静态托管平台。

## 推荐方式：GitHub Pages

1. 登录 GitHub。
2. 新建公开仓库，例如 `surface-tension-lab`。
3. 上传以下文件到仓库根目录：
   - `index.html`
   - `styles.css`
   - `app.js`
   - `README.md`
   - `.nojekyll`
   - `.github/workflows/pages.yml`
4. 进入仓库 `Settings` -> `Pages`。
5. `Source` 选择 `GitHub Actions`。
7. 保存后等待 1-3 分钟。

最终永久网址一般是：

```text
https://你的GitHub用户名.github.io/surface-tension-lab/
```

## 单文件部署

如果平台只方便上传一个文件，可以上传：

```text
surface-tension-permanent.html
```

上传后建议把文件名改成：

```text
index.html
```

这样访问域名根路径时会自动打开网页。

## 说明

- 当前临时 Cloudflare 链接不是永久部署，电脑关机或进程关闭后会失效。
- 永久部署必须绑定到一个长期托管平台账号。
- 如果把 GitHub 仓库名发给 Codex，且 GitHub 连接器对该仓库有写入权限，Codex 可以继续帮你上传文件。
