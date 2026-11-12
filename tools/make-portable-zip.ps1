param([Parameter(Mandatory=$true)][string]$Folder)
$ErrorActionPreference = 'Stop'
$sourceRoot = (Resolve-Path -LiteralPath $Folder).Path.TrimEnd('\')
if (-not (Test-Path -LiteralPath (Join-Path $sourceRoot 'runtime\node-win-x64\node.exe'))) { throw '동봉 실행 파일이 없습니다.' }
$archivePath = $sourceRoot + '.zip'
if (Test-Path -LiteralPath $archivePath) { throw '같은 이름의 ZIP이 이미 있습니다. 기존 파일을 확인한 뒤 새 이름으로 만드세요.' }
Compress-Archive -LiteralPath $sourceRoot -DestinationPath $archivePath -CompressionLevel Optimal
$archive = [System.IO.Compression.ZipFile]::OpenRead($archivePath)
$sha = [System.Security.Cryptography.SHA256]::Create()
$checked = 0
$prefix = [System.IO.Path]::GetFileName($sourceRoot) + '/'
try {
 foreach ($entry in $archive.Entries) {
  if ($entry.FullName.EndsWith('/')) { continue }
  $normalizedEntry = $entry.FullName.Replace('\','/')
  if (-not $normalizedEntry.StartsWith($prefix,[System.StringComparison]::Ordinal)) { throw 'ZIP 최상위 폴더 불일치' }
  $relativePath = $normalizedEntry.Substring($prefix.Length)
  $originalPath = [System.IO.Path]::GetFullPath((Join-Path $sourceRoot $relativePath))
  if (-not $originalPath.StartsWith($sourceRoot + '\',[System.StringComparison]::OrdinalIgnoreCase)) { throw '범위를 벗어난 ZIP 경로' }
  $sourceStream = [System.IO.File]::OpenRead($originalPath)
  $zipStream = $entry.Open()
  try {
   $sourceHash = [Convert]::ToHexString($sha.ComputeHash($sourceStream))
   $zipHash = [Convert]::ToHexString($sha.ComputeHash($zipStream))
   if ($sourceHash -ne $zipHash) { throw "ZIP 내용 불일치: $relativePath" }
  } finally { $sourceStream.Dispose(); $zipStream.Dispose() }
  $checked++
 }
 $expected = @(Get-ChildItem -LiteralPath $sourceRoot -File -Recurse -Force).Count
 if ($checked -ne $expected) { throw "ZIP 파일 수 불일치: $checked / $expected" }
} finally { $archive.Dispose(); $sha.Dispose() }
$record = [ordered]@{date=(Get-Date).ToUniversalTime().ToString('o');pass=$true;zip=$archivePath;bytes=(Get-Item -LiteralPath $archivePath).Length;sha256=(Get-FileHash -LiteralPath $archivePath -Algorithm SHA256).Hash.ToLowerInvariant();payloadFilesVerified=$checked;allPayloadSHA256Equal=$true;note='압축을 읽어 모든 파일을 원본과 SHA-256 비교. 실제 다른 PC/카메라 검증 아님.'}
$record | ConvertTo-Json | Set-Content -LiteralPath (Join-Path $PSScriptRoot '..\docs\portable-zip-validation.json') -Encoding utf8
$record | ConvertTo-Json
