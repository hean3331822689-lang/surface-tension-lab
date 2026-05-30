$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $root "index.html"
$stylePath = Join-Path $root "styles.css"
$scriptPath = Join-Path $root "app.js"
$outputPath = Join-Path $root "surface-tension-permanent.html"

$html = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8
$css = Get-Content -LiteralPath $stylePath -Raw -Encoding UTF8
$js = Get-Content -LiteralPath $scriptPath -Raw -Encoding UTF8

$html = $html.Replace('    <link rel="stylesheet" href="./styles.css" />', "    <style>`n$css`n    </style>")
$html = $html.Replace('    <script src="./app.js"></script>', "    <script>`n$js`n    </script>")
$html = $html.Replace("<title>液体表面张力系数测量实验数据处理</title>", "<title>液体表面张力系数测量实验数据处理 - 永久部署版</title>")

Set-Content -LiteralPath $outputPath -Value $html -Encoding UTF8
Write-Host "Created $outputPath"
