# Drives the native "Open project" folder picker (IFileOpenDialog) for the
# installed-app Change Project test.
#
# Strategy: WM_SETTEXT the absolute target path into the folder-name box
# (dialog control 1152), then BM_CLICK "Select Folder" (dialog item 1).
# The dialog resolves the typed path itself — this works regardless of
# which folder or library (e.g. "Documents") the dialog opened on; the
# previous breadcrumb+tree walk failed whenever the initial location
# exposed no filesystem path. No foreground/keyboard focus needed.
#
#   pwsh -File tests/e2e/pick-folder.ps1 -ProcId <pid> -Folder <abs path> [-Cancel]
param(
  [Parameter(Mandatory = $true)][int]$ProcId,
  [Parameter(Mandatory = $true)][string]$Folder,
  [switch]$Cancel,
  [int]$TimeoutSec = 30
)
$ErrorActionPreference = "Stop"

Add-Type @"
using System;
using System.Text;
using System.Runtime.InteropServices;
public class DlgWin {
  [DllImport("user32.dll")] public static extern bool EnumWindows(EnumProc cb, IntPtr l);
  [DllImport("user32.dll")] public static extern int GetWindowText(IntPtr h, StringBuilder s, int n);
  [DllImport("user32.dll")] public static extern uint GetWindowThreadProcessId(IntPtr h, out uint pid);
  [DllImport("user32.dll")] public static extern bool IsWindowVisible(IntPtr h);
  [DllImport("user32.dll")] public static extern IntPtr GetDlgItem(IntPtr h, int id);
  [DllImport("user32.dll", CharSet=CharSet.Unicode)] public static extern IntPtr SendMessageW(IntPtr h, uint m, IntPtr w, string l);
  [DllImport("user32.dll")] public static extern IntPtr SendMessageW(IntPtr h, uint m, IntPtr w, IntPtr l);
  public const uint BM_CLICK = 0x00F5, WM_SETTEXT = 0x000C;
  public delegate bool EnumProc(IntPtr h, IntPtr l);
  public static IntPtr FindTop(uint pid, string title) {
    IntPtr found = IntPtr.Zero;
    EnumWindows((h, l) => {
      uint p; GetWindowThreadProcessId(h, out p);
      if (p != pid || !IsWindowVisible(h)) return true;
      var t = new StringBuilder(512); GetWindowText(h, t, 512);
      if (t.ToString() == title) { found = h; return false; }
      return true;
    }, IntPtr.Zero);
    return found;
  }
}
"@

$deadline = (Get-Date).AddSeconds($TimeoutSec)
$h = [IntPtr]::Zero
while ((Get-Date) -lt $deadline -and $h -eq [IntPtr]::Zero) {
  $h = [DlgWin]::FindTop($ProcId, "Open project")
  if ($h -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 250 }
}
if ($h -eq [IntPtr]::Zero) { Write-Host "NO_DIALOG"; exit 2 }

if ($Cancel) {
  $cn = [DlgWin]::GetDlgItem($h, 2)
  if ($cn -ne [IntPtr]::Zero) {
    [void][DlgWin]::SendMessageW($cn, [DlgWin]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)
  }
  Write-Host "CANCELLED"
  exit 0
}

# The folder-name box is dialog control 1152 (Edit inside ComboBoxEx32);
# it may take a moment to materialize after the dialog appears.
$edit = [IntPtr]::Zero
$editDeadline = (Get-Date).AddSeconds(10)
while ((Get-Date) -lt $editDeadline -and $edit -eq [IntPtr]::Zero) {
  $edit = [DlgWin]::GetDlgItem($h, 1152)
  if ($edit -eq [IntPtr]::Zero) { Start-Sleep -Milliseconds 250 }
}
if ($edit -eq [IntPtr]::Zero) { Write-Host "NO_NAMEBOX"; exit 3 }

[void][DlgWin]::SendMessageW($edit, [DlgWin]::WM_SETTEXT, [IntPtr]::Zero, $Folder.TrimEnd("\"))
Start-Sleep -Milliseconds 400

$btn = [DlgWin]::GetDlgItem($h, 1)
if ($btn -eq [IntPtr]::Zero) { Write-Host "NO_BUTTON"; exit 4 }
[void][DlgWin]::SendMessageW($btn, [DlgWin]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)

# If the typed path only *navigated* instead of returning, the dialog
# stays open — commit again now that ShellView sits on the target.
Start-Sleep -Milliseconds 900
if ([DlgWin]::FindTop($ProcId, "Open project") -ne [IntPtr]::Zero) {
  [void][DlgWin]::SendMessageW($btn, [DlgWin]::BM_CLICK, [IntPtr]::Zero, [IntPtr]::Zero)
  Start-Sleep -Milliseconds 900
}

if ([DlgWin]::FindTop($ProcId, "Open project") -ne [IntPtr]::Zero) {
  Write-Host "STILL_OPEN"; exit 8
}
Write-Host "PICKED"
