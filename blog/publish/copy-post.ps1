$ErrorActionPreference = 'Stop'
[Console]::OutputEncoding = [System.Text.Encoding]::UTF8
Add-Type -AssemblyName System.Windows.Forms
function Copy-Text([string]$text) { [System.Windows.Forms.Clipboard]::SetDataObject($text, $true) }
$root = $PSScriptRoot
$dirs = Get-ChildItem -Directory $root | Where-Object { Test-Path (Join-Path $_.FullName 'tistory.html') } | Sort-Object Name

Write-Host ''
Write-Host '=== 블로그 글 복사 도우미 ===' -ForegroundColor Green
Write-Host ''
$i = 1
foreach ($d in $dirs) {
  $first = (Get-Content (Join-Path $d.FullName '발행-안내.md') -TotalCount 1 -Encoding UTF8) -replace '^# ', ''
  Write-Host ('{0,2}. {1}' -f $i, $first)
  $i++
}
Write-Host ''
$n = [int](Read-Host '올릴 글 번호')
$d = $dirs[$n - 1]
$where = Read-Host '어디에 올려요?  1 = 티스토리   2 = 네이버'
$guide = Get-Content (Join-Path $d.FullName '발행-안내.md') -Encoding UTF8

if ($where -eq '1') {
  Write-Host ''
  Write-Host '--- 티스토리 발행 정보 (그대로 입력) ---' -ForegroundColor Cyan
  foreach ($key in '- 제목:', '- 카테고리:', '- 주소(슬러그):', '- 태그:') {
    $line = $guide | Where-Object { $_.StartsWith($key) } | Select-Object -First 1
    Write-Host $line
  }
  Copy-Text (Get-Content -Raw -Encoding UTF8 (Join-Path $d.FullName 'tistory.html'))
  Write-Host ''
  Write-Host '[완료] tistory.html 전체가 클립보드에 복사됐어요.' -ForegroundColor Green
  Write-Host '글쓰기 > 기본모드를 HTML 로 바꾸고 Ctrl+V 하세요. 이미지 폴더도 열어 둘게요.'
} else {
  $all = Get-Content -Encoding UTF8 (Join-Path $d.FullName 'naver-plain.txt')
  $title = $all[0]
  $body = ($all | Select-Object -Skip 2) -join [Environment]::NewLine
  Copy-Text $title
  Write-Host ''
  Write-Host '[1/2] 제목이 복사됐어요. 네이버 제목 칸에 붙여 넣고 Enter 를 누르세요.' -ForegroundColor Cyan
  Write-Host $title
  [void](Read-Host '제목을 붙여 넣었으면 Enter')
  Copy-Text $body
  Write-Host '[2/2] 본문이 복사됐어요. 본문 칸에 Ctrl+V 하세요.' -ForegroundColor Green
}

Write-Host ''
Write-Host '--- 이미지 (올릴 순서) ---' -ForegroundColor Cyan
$start = $false
foreach ($l in $guide) {
  if ($l.StartsWith('## 이미지')) { $start = $true; continue }
  if ($start -and $l.Trim().Length -gt 0) { Write-Host $l }
}
Start-Process explorer.exe (Join-Path $d.FullName 'images')
