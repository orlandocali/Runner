# start-server.ps1 - Simple static HTTP server implemented with HttpListener
# Serves files from the current working directory on http://localhost:8000/

Add-Type -AssemblyName System.Web

$prefix = 'http://localhost:8000/'
$listener = New-Object System.Net.HttpListener
$listener.Prefixes.Add($prefix)
$listener.Start()
Write-Host "Serving on $prefix (press Ctrl+C to stop)"

# Handle Ctrl+C (SIGINT) to stop the listener cleanly
[Console]::TreatControlCAsInput = $false
$cancellation = $false
# Try to register a CancelKeyPress handler in a way that works in different PowerShell hosts
try{
    # Preferred: use Register-ObjectEvent for Console cancel events
    $null = Register-ObjectEvent -InputObject [Console] -EventName CancelKeyPress -Action {
        param($sender,$e)
        $e.Cancel = $true
        Write-Host "`nStopping server..."
        $script:cancellation = $true
        try{ $listener.Stop() } catch {}
    }
} catch {
    # Fallback: try to add to CancelKeyPress directly (may fail in some hosts)
    try{
        [Console]::CancelKeyPress.add({ param($sender,$e) $e.Cancel = $true; Write-Host "`nStopping server..."; $script:cancellation = $true; $listener.Stop() })
    } catch {
        Write-Host "Warning: could not register Ctrl+C handler in this PowerShell host. Close the window to stop the server." -ForegroundColor Yellow
    }
}

# Basic mime-type map
$mimes = @{
    '.html' = 'text/html; charset=utf-8'
    '.htm'  = 'text/html; charset=utf-8'
    '.js'   = 'application/javascript; charset=utf-8'
    '.mjs'  = 'application/javascript; charset=utf-8'
    '.css'  = 'text/css; charset=utf-8'
    '.json' = 'application/json; charset=utf-8'
    '.png'  = 'image/png'
    '.jpg'  = 'image/jpeg'
    '.jpeg' = 'image/jpeg'
    '.gif'  = 'image/gif'
    '.svg'  = 'image/svg+xml'
    '.ico'  = 'image/x-icon'
    '.wav'  = 'audio/wav'
    '.mp3'  = 'audio/mpeg'
    '.woff' = 'font/woff'
    '.woff2' = 'font/woff2'
}

try{
    while ($listener.IsListening -and -not $cancellation) {
        # if Stop was requested, break
        if ($cancellation) { break }
        $context = $listener.GetContext()
        $req = $context.Request
        $res = $context.Response
        $rawPath = $req.Url.LocalPath.TrimStart('/')
        if ([string]::IsNullOrEmpty($rawPath)) { $rawPath = 'index.html' }
        # prevent path escape
        $rawPath = $rawPath -replace '\\.\\./',''
        $file = Join-Path (Get-Location) $rawPath
        if (Test-Path $file) {
            try{
                $ext = [System.IO.Path]::GetExtension($file).ToLower()
                $bytes = [System.IO.File]::ReadAllBytes($file)
                if ($mimes.ContainsKey($ext)) { $res.ContentType = $mimes[$ext] } else { $res.ContentType = 'application/octet-stream' }
                $res.ContentLength64 = $bytes.Length
                $res.OutputStream.Write($bytes, 0, $bytes.Length)
                $res.OutputStream.Close()
            } catch {
                $res.StatusCode = 500
                $msg = "Internal Server Error"
                $buf = [System.Text.Encoding]::UTF8.GetBytes($msg)
                $res.ContentType = 'text/plain; charset=utf-8'
                $res.ContentLength64 = $buf.Length
                $res.OutputStream.Write($buf,0,$buf.Length)
                $res.OutputStream.Close()
            }
        } else {
            $res.StatusCode = 404
            $msg = "404 - Not Found"
            $buf = [System.Text.Encoding]::UTF8.GetBytes($msg)
            $res.ContentType = 'text/plain; charset=utf-8'
            $res.ContentLength64 = $buf.Length
            $res.OutputStream.Write($buf,0,$buf.Length)
            $res.OutputStream.Close()
        }
    }
} finally {
    $listener.Stop()
    $listener.Close()
}
