param (
    [int]$Port = 8080
)

$baseDir = $PSScriptRoot

$cache = @{}
$mimeCache = @{}

$mimeTypes = @{
    ".html" = "text/html; charset=utf-8"
    ".css"  = "text/css; charset=utf-8"
    ".js"   = "application/javascript; charset=utf-8"
    ".jpg"  = "image/jpeg"
    ".jpeg" = "image/jpeg"
    ".png"  = "image/png"
    ".svg"  = "image/svg+xml"
    ".json" = "application/json"
    ".ico"  = "image/x-icon"
    ".mp4"  = "video/mp4"
    ".webm" = "video/webm"
}

Write-Host "Pre-caching assets into memory..."
Get-ChildItem -Path $baseDir -Recurse -File | ForEach-Object {
    $rel = $_.FullName.Substring($baseDir.Length).Replace('\', '/')
    $ext = $_.Extension.ToLower()
    $mime = if ($mimeTypes.ContainsKey($ext)) { $mimeTypes[$ext] } else { "application/octet-stream" }
    try {
        $bytes = [System.IO.File]::ReadAllBytes($_.FullName)
        $cache[$rel] = $bytes
        $mimeCache[$rel] = $mime
        $cache[$rel.ToLower()] = $bytes
        $mimeCache[$rel.ToLower()] = $mime
    } catch {}
}

$listener = New-Object System.Net.HttpListener
$prefix = "http://localhost:$Port/"
$listener.Prefixes.Add($prefix)

try {
    $listener.Start()
} catch {
    $Port = 8085
    $prefix = "http://localhost:$Port/"
    $listener = New-Object System.Net.HttpListener
    $listener.Prefixes.Add($prefix)
    $listener.Start()
}

Write-Host "HTTP server running at $prefix (Preloaded $($cache.Count) files into memory with MP4 Range support)"

while ($listener.IsListening) {
    try {
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response

        $rawPath = [System.Uri]::UnescapeDataString($req.Url.AbsolutePath)
        if ($rawPath -eq "/" -or [string]::IsNullOrWhiteSpace($rawPath)) {
            $rawPath = "/index.html"
        }

        # Anti-caching headers for dev iteration
        $res.Headers.Add("Access-Control-Allow-Origin", "*")
        $res.Headers.Add("Accept-Ranges", "bytes")
        $res.Headers.Add("Cache-Control", "no-cache, no-store, must-revalidate")

        $targetKey = $null
        if ($cache.ContainsKey($rawPath)) {
            $targetKey = $rawPath
        } elseif ($cache.ContainsKey($rawPath.ToLower())) {
            $targetKey = $rawPath.ToLower()
        }

        if ($targetKey) {
            $data = $cache[$targetKey]
            $res.ContentType = $mimeCache[$targetKey]

            # Support HTTP 206 Partial Content for smooth video seeking in Chrome
            $rangeHeader = $req.Headers["Range"]
            if ($rangeHeader -and $rangeHeader -match "bytes=(\d+)-(\d*)") {
                $start = [int64]$matches[1]
                $end = if ($matches[2]) { [int64]$matches[2] } else { $data.Length - 1 }
                if ($end -ge $data.Length) { $end = $data.Length - 1 }
                $len = $end - $start + 1

                $res.StatusCode = 206
                $res.Headers.Add("Content-Range", "bytes $start-$end/$($data.Length)")
                $res.ContentLength64 = $len
                $res.OutputStream.Write($data, $start, $len)
            } else {
                $res.ContentLength64 = $data.Length
                $res.OutputStream.Write($data, 0, $data.Length)
            }
        } else {
            $res.StatusCode = 404
            $res.ContentType = "text/plain"
            $msg = [System.Text.Encoding]::UTF8.GetBytes("404 Not Found: $rawPath")
            $res.OutputStream.Write($msg, 0, $msg.Length)
        }
        $res.OutputStream.Close()
    } catch {
        # continue loop
    }
}
