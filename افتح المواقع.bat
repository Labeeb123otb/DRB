@echo off
chcp 65001 >nul
title Darb Al-Najah - Local Server
echo.
echo  ╔══════════════════════════════════════╗
echo  ║   درب النجاح - السيرفر المحلي       ║
echo  ║   افتح المتصفح على:                ║
echo  ║   http://localhost:8080              ║
echo  ╚══════════════════════════════════════╝
echo.
echo  للتحكم في وضع التحرير:
echo  اضغط Ctrl+E لتفعيل/إلغاء وضع التحرير
echo.
cd /d "%~dp0"
powershell -ExecutionPolicy Bypass -Command "$listener = [System.Net.HttpListener]::new(); $listener.Prefixes.Add('http://localhost:8080/'); $listener.Start(); Write-Host 'Server running on http://localhost:8080' -ForegroundColor Green; while($listener.IsListening) { $ctx = $listener.GetContext(); $file = Join-Path $PWD.Path ($ctx.Request.Url.LocalPath -replace '/','\'); if($ctx.Request.Url.LocalPath -eq '/') { $file = Join-Path $PWD.Path 'index.html' }; if(Test-Path $file -PathType Leaf) { $ext = [IO.Path]::GetExtension($file); $types = @{'.html'='text/html; charset=utf-8';'.css'='text/css; charset=utf-8';'.js'='application/javascript; charset=utf-8';'.png'='image/png';'.jpg'='image/jpeg';'.svg'='image/svg+xml'}; $ctx.Response.ContentType = $types[$ext]; $bytes = [IO.File]::ReadAllBytes($file); $ctx.Response.ContentLength64 = $bytes.Length; $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) } else { $ctx.Response.StatusCode = 404; $bytes = [Text.Encoding]::UTF8.GetBytes('Not Found'); $ctx.Response.OutputStream.Write($bytes, 0, $bytes.Length) }; $ctx.Response.Close() }"
pause
