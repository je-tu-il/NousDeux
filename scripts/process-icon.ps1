Add-Type -AssemblyName System.Drawing

$sourcePath = "C:\Users\JulesR\.gemini\antigravity\brain\1ae6cee9-4469-4771-ab45-a713de77da5b\nousdeux_app_icon_1791579282960.jpg"
$baseDir = "E:\Reste\PROJET_PERSO\Nousdeux\assets\images"

$srcImage = [System.Drawing.Image]::FromFile($sourcePath)

function Resize-And-Save($targetWidth, $targetHeight, $destPath) {
    $bmp = New-Object System.Drawing.Bitmap $targetWidth, $targetHeight
    $graphics = [System.Drawing.Graphics]::FromImage($bmp)
    $graphics.InterpolationMode = [System.Drawing.Drawing2D.InterpolationMode]::HighQualityBicubic
    $graphics.SmoothingMode = [System.Drawing.Drawing2D.SmoothingMode]::HighQuality
    $graphics.PixelOffsetMode = [System.Drawing.Drawing2D.PixelOffsetMode]::HighQuality
    $graphics.DrawImage($srcImage, 0, 0, $targetWidth, $targetHeight)
    $graphics.Dispose()
    
    # Save as PNG
    $bmp.Save($destPath, [System.Drawing.Imaging.ImageFormat]::Png)
    $bmp.Dispose()
    Write-Output "Generated: $destPath ($targetWidth x $targetHeight)"
}

Resize-And-Save 1024 1024 "$baseDir\icon.png"
Resize-And-Save 1024 1024 "$baseDir\splash-icon.png"
Resize-And-Save 1024 1024 "$baseDir\android-icon-foreground.png"
Resize-And-Save 1024 1024 "$baseDir\android-icon-monochrome.png"
Resize-And-Save 196 196 "$baseDir\favicon.png"

$srcImage.Dispose()
Write-Output "Icon generation complete!"
