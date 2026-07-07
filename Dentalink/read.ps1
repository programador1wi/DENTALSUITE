Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead("C:\Users\X\Downloads\Manual_Detallado_Flujo_Ortodoncia_Dentalink.docx")
$entry = $zip.GetEntry("word/document.xml")
$stream = $entry.Open()
$reader = New-Object System.IO.StreamReader($stream)
$xml = $reader.ReadToEnd()
$reader.Close()
$zip.Dispose()
$xml = $xml -replace '<[^>]+>', ' '
$xml = $xml -replace '\s+', ' '
Write-Host $xml
