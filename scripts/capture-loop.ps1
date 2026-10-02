# Continuously captures a window via PrintWindow (PW_RENDERFULLCONTENT)
# into numbered PNG frames - the same mechanism as capture-window.ps1,
# looped for video. Works even when the window is occluded because
# PrintWindow renders the DWM-composited surface, not screen pixels.
# Stops when $StopFile appears or $MaxSeconds elapse.
#
# Usage: powershell -File capture-loop.ps1 -ProcId <pid> -OutDir <dir>
#          -StopFile <path> [-Fps 6] [-MaxSeconds 180]
param(
  [Parameter(Mandatory = $true)][int]$ProcId,
  [Parameter(Mandatory = $true)][string]$OutDir,
  [Parameter(Mandatory = $true)][string]$StopFile,
  [double]$Fps = 6,
  [int]$MaxSeconds = 180
)

Add-Type -AssemblyName System.Drawing
Add-Type @"
using System;
using System.Runtime.InteropServices;
public class CapLoopWin {
  [DllImport("user32.dll")] public static extern bool GetWindowRect(IntPtr hWnd, out RECT r);
  [DllImport("user32.dll")] public static extern bool PrintWindow(IntPtr hWnd, IntPtr hdcBlt, uint flags);
  public struct RECT { public int Left, Top, Right, Bottom; }
}
"@

$proc = Get-Process -Id $ProcId -ErrorAction Stop
$hwnd = $proc.MainWindowHandle
if ($hwnd -eq 0) { Write-Error "no main window"; exit 1 }

$r = New-Object CapLoopWin+RECT
[void][CapLoopWin]::GetWindowRect($hwnd, [ref]$r)
$w = $r.Right - $r.Left
$h = $r.Bottom - $r.Top
if ($w -le 0 -or $h -le 0) { Write-Error "bad rect ${w}x${h}"; exit 1 }
$w = $w -band (-2) # even width/height for downstream encoders
$h = $h -band (-2)

$interval = [int](1000 / $Fps)
$deadline = (Get-Date).AddSeconds($MaxSeconds)
$i = 0
while (-not (Test-Path $StopFile) -and (Get-Date) -lt $deadline) {
  $t = Get-Date
  $bmp = New-Object System.Drawing.Bitmap $w, $h
  $g = [System.Drawing.Graphics]::FromImage($bmp)
  $hdc = $g.GetHdc()
  [void][CapLoopWin]::PrintWindow($hwnd, $hdc, 2)
  $g.ReleaseHdc($hdc)
  $g.Dispose()
  $frame = Join-Path $OutDir ("f{0:d4}.png" -f $i)
  $bmp.Save($frame, [System.Drawing.Imaging.ImageFormat]::Png)
  $bmp.Dispose()
  $i++
  $elapsed = ((Get-Date) - $t).TotalMilliseconds
  if ($elapsed -lt $interval) { Start-Sleep -Milliseconds ($interval - $elapsed) }
}
Write-Output "captured $i frames at ${w}x${h}"
