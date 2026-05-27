$ErrorActionPreference = 'Stop'

$Root = Resolve-Path (Join-Path $PSScriptRoot '..')
$ManifestPath = Join-Path $Root 'manifest.json'
$Manifest = Get-Content -Encoding UTF8 -Raw $ManifestPath | ConvertFrom-Json
$Version = $Manifest.version
$Dist = Join-Path $Root 'dist'
$Stage = Join-Path $Dist 'package-stage'
$ZipPath = Join-Path $Dist "pansub-$Version.zip"

$RequiredFiles = @(
  'manifest.json',
  'background.js',
  'content.js',
  'glossary.js',
  'popup.html',
  'popup.js',
  'options.html',
  'options.css',
  'options.js',
  'assets/icon16.png',
  'assets/icon32.png',
  'assets/icon48.png',
  'assets/icon128.png'
)

if (Test-Path $Stage) {
  Remove-Item -LiteralPath $Stage -Recurse -Force
}
New-Item -ItemType Directory -Path $Stage | Out-Null
New-Item -ItemType Directory -Path $Dist -Force | Out-Null

foreach ($file in $RequiredFiles) {
  $source = Join-Path $Root $file
  if (!(Test-Path $source)) {
    throw "Missing release file: $file"
  }

  $target = Join-Path $Stage $file
  $targetDir = Split-Path $target -Parent
  New-Item -ItemType Directory -Path $targetDir -Force | Out-Null
  Copy-Item -LiteralPath $source -Destination $target -Force
}

if (Test-Path $ZipPath) {
  Remove-Item -LiteralPath $ZipPath -Force
}
Compress-Archive -Path (Join-Path $Stage '*') -DestinationPath $ZipPath -CompressionLevel Optimal

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead($ZipPath)
try {
  $entries = @($zip.Entries | ForEach-Object { $_.FullName.Replace('\', '/') })
  if (!($entries -contains 'manifest.json')) {
    throw 'Package verification failed: manifest.json is not at zip root.'
  }
  foreach ($file in $RequiredFiles) {
    if (!($entries -contains $file)) {
      throw "Package verification failed: missing $file"
    }
  }
} finally {
  $zip.Dispose()
}

Remove-Item -LiteralPath $Stage -Recurse -Force
Write-Host "Created $ZipPath"
