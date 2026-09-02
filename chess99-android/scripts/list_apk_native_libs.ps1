# Lists the native libraries packaged in an APK, per ABI.
# Usage: powershell.exe -File scripts\list_apk_native_libs.ps1 <path-to-apk>
param([Parameter(Mandatory = $true)][string]$ApkPath)

Add-Type -AssemblyName System.IO.Compression.FileSystem
$zip = [System.IO.Compression.ZipFile]::OpenRead((Resolve-Path $ApkPath))
try {
    $zip.Entries |
        Where-Object { $_.FullName -like 'lib/*' } |
        Sort-Object FullName |
        ForEach-Object { '{0}  {1:N0} bytes' -f $_.FullName, $_.Length }
} finally {
    $zip.Dispose()
}
