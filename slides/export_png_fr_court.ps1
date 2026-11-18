# Export every slide of the deck to PNG with PowerPoint (visual QA). Usage: powershell -File export_png.ps1
$deck = Join-Path $PSScriptRoot "BSA_nuit_IR_FR_court.pptx"
$out = Join-Path $PSScriptRoot "qa_fr_court"
New-Item -ItemType Directory -Force $out | Out-Null
Get-ChildItem $out -Filter *.png | Remove-Item -Force
$pp = New-Object -ComObject PowerPoint.Application
$p = $pp.Presentations.Open($deck, $true, $false, $false)  # read-only, no window
$i = 1
foreach ($s in $p.Slides) { $s.Export((Join-Path $out ("slide{0:D2}.png" -f $i)), "PNG", 1600, 900); $i++ }
$p.Close(); if ($pp.Presentations.Count -eq 0) { $pp.Quit() }  # never close the user's open decks
Get-ChildItem $out -Filter *.png | ForEach-Object { $_.FullName }
