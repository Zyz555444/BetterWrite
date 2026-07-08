param(
    [string]$Command
)

$pass = "Sz555444"
$host_addr = "103.79.186.155"

# Use ssh with password via stdin
$proc = New-Object System.Diagnostics.Process
$proc.StartInfo.FileName = "ssh"
$proc.StartInfo.Arguments = "-o StrictHostKeyChecking=no -o UserKnownHostsFile=NUL root@$host_addr `"$Command`""
$proc.StartInfo.UseShellExecute = $false
$proc.StartInfo.RedirectStandardInput = $true
$proc.StartInfo.RedirectStandardOutput = $true
$proc.StartInfo.RedirectStandardError = $true

$proc.Start() | Out-Null

# Wait for password prompt
Start-Sleep -Seconds 2

# Send password
$proc.StandardInput.WriteLine($pass)
$proc.StandardInput.Flush()
$proc.StandardInput.Close()

# Read output
$output = $proc.StandardOutput.ReadToEnd()
$error_out = $proc.StandardError.ReadToEnd()

$proc.WaitForExit()

Write-Output "=== STDOUT ==="
Write-Output $output
Write-Output "=== STDERR ==="
Write-Output $error_out
Write-Output "=== EXIT CODE: $($proc.ExitCode) ==="
