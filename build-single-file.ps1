$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $MyInvocation.MyCommand.Path
$indexPath = Join-Path $root "index.html"
$outputPath = Join-Path $root "surface-tension-permanent.html"

$html = Get-Content -LiteralPath $indexPath -Raw -Encoding UTF8

$html = $html.Replace("<title>液体表面张力系数测量实验数据处理</title>", "<title>液体表面张力系数测量实验数据处理 - 永久部署版</title>")

Set-Content -LiteralPath $outputPath -Value $html -Encoding UTF8
Write-Host "Created $outputPath"
