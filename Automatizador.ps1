$availableFolders = Get-ChildItem -Directory | Where-Object { Test-Path (Join-Path $_.FullName "audios") } | Select-Object -ExpandProperty Name

if ($availableFolders.Count -eq 0) {
    Write-Host "No se encontró ninguna carpeta que contenga una subcarpeta 'audios'." -ForegroundColor Red
    Write-Host "Presiona Enter para salir..."
    Read-Host
    exit
}

Write-Host "Carpetas detectadas con audios:" -ForegroundColor Cyan
Write-Host ($availableFolders -join ", ") -ForegroundColor Yellow
Write-Host ""
Write-Host "Opciones de procesamiento:"
Write-Host "[*] Escribe '*' para procesar TODAS las carpetas."
Write-Host "[nombre] Escribe el nombre de una carpeta (ej: rap)."
Write-Host "[nombres] Escribe varios nombres separados por comas (ej: rap, pop, salsa)."
Write-Host ""
$inputStr = Read-Host "Ingresa tu opcion (ej. rap, pop, salsa, ryb o *)"

$foldersToProcess = @()

if ($inputStr.Trim() -eq "*") {
    $foldersToProcess = $availableFolders
} else {
    $inputFolders = $inputStr -split "," | ForEach-Object { $_.Trim() }
    foreach ($f in $inputFolders) {
        if ($availableFolders -contains $f) {
            $foldersToProcess += $f
        } else {
            Write-Host "Advertencia: La carpeta '$f' no existe o no tiene subcarpeta 'audios'. Se omitirá." -ForegroundColor Yellow
        }
    }
}

if ($foldersToProcess.Count -eq 0) {
    Write-Host "No se seleccionó ninguna carpeta válida." -ForegroundColor Red
    Write-Host "Presiona Enter para salir..."
    Read-Host
    exit
}

$totalProcessed = 0

foreach ($folder in $foldersToProcess) {
    Write-Host "`n--- Procesando carpeta: $folder ---" -ForegroundColor Cyan
    $dir = ".\$folder\audios"
    
    $files = Get-ChildItem -Path $dir -Filter '*.mp3'
    if ($files.Count -eq 0) {
        Write-Host "No se encontraron archivos .mp3 en $dir. Saltando..." -ForegroundColor Yellow
        continue
    }
    
    $jsonPath = ".\$folder\ringtones.json"
    $existingJson = @()
    if (Test-Path $jsonPath) {
        # Importante: usar -Encoding UTF8 para evitar que los acentos se dañen al leer (ej. "Ã‰l")
        $existingData = Get-Content $jsonPath -Raw -Encoding UTF8 | ConvertFrom-Json
        
        # Desempaquetar el "value" si el archivo venia con el bug anterior
        while ($null -ne $existingData -and $null -ne $existingData.value) {
            $existingData = $existingData.value
        }
        
        if ($null -ne $existingData) {
            if ($existingData -is [array]) {
                $existingJson = $existingData
            } else {
                $existingJson = @($existingData)
            }
        }
    }
    
    $jsonArray = @()
    if ($existingJson.Count -gt 0) {
        $jsonArray = $existingJson
    }
    
    $maxId = 0
    foreach ($item in $jsonArray) {
        try {
            $curr = [int]($item.id)
            if ($curr -gt $maxId) { $maxId = $curr }
        } catch {}
    }
    
    foreach ($f in $files) {
        $oldName = $f.Name
        $basename = $f.BaseName
        
        # Si empieza con numeros y un guion (ej. "0001 - "), guardamos el numero y limpiamos el nombre
        if ($basename -match '^(\d+)\s*-\s*(.+)$') {
            $forcedId = [int]$matches[1]
            $basenameClean = $matches[2]
            $oldNameClean = $oldName -replace '^\d+\s*-\s*', ''
        } else {
            $forcedId = 0
            $basenameClean = $basename
            $oldNameClean = $oldName
        }
        
        # Crear un slug seguro para el archivo usando el nombre limpio
        $newName = $oldNameClean.ToLower()
        $newName = $newName -replace ' - ', '-'
        $newName = $newName -replace ' ', '-'
        
        # Quitar acentos comunes
        $newName = $newName -replace '[áàäâ]', 'a'
        $newName = $newName -replace '[éèëê]', 'e'
        $newName = $newName -replace '[íìïî]', 'i'
        $newName = $newName -replace '[óòöô]', 'o'
        $newName = $newName -replace '[úùüû]', 'u'
        $newName = $newName -replace 'ñ', 'n'
        
        $newName = $newName -replace '[^a-z0-9\.-]', ''
        $newName = $newName -replace '-+', '-'
        
        $newPath = Join-Path $f.DirectoryName $newName
        $audioPathToMatch = "audios/$newName"
        
        # Renombrar el archivo fisico si es necesario
        if ($f.FullName -ne $newPath) {
            if (Test-Path -LiteralPath $newPath) {
                Remove-Item -LiteralPath $f.FullName -Force
            } else {
                Rename-Item -LiteralPath $f.FullName -NewName $newName
            }
        }
        
        # Extraer artista y titulo del nombre limpio
        $parts = $basenameClean -split ' - ', 2
        if ($parts.Length -eq 2) {
            $subtitle = $parts[0].Trim()
            $title = $parts[1].Trim()
        } elseif ($basenameClean -match '---') {
            $parts = $basenameClean -split '---', 2
            $subtitle = (Get-Culture).TextInfo.ToTitleCase($parts[0].Replace('-', ' '))
            $title = (Get-Culture).TextInfo.ToTitleCase($parts[1].Replace('-', ' '))
        } else {
            $subtitle = "Unknown"
            $title = $basenameClean.Trim()
        }
        
        # Buscar si ya esta en el JSON (para no agregarlo de nuevo ni alterar su ID/orden)
        $alreadyAdded = $jsonArray | Where-Object { $_.audioPath -eq $audioPathToMatch } | Select-Object -First 1
        
        if ($null -eq $alreadyAdded) {
            if ($forcedId -gt 0) {
                $currentId = $forcedId
                if ($forcedId -gt $maxId) { $maxId = $forcedId }
            } else {
                $maxId++
                $currentId = $maxId
            }

            $obj = [ordered]@{
                id = [string]$currentId
                title = $title
                subtitle = $subtitle
                audioPath = $audioPathToMatch
                posterPath = ""
            }
            
            $jsonArray += $obj
        } else {
            # Si ya existe pero esta como Unknown, lo actualizamos
            if ($alreadyAdded.subtitle -eq 'Unknown' -and $subtitle -ne 'Unknown') {
                $alreadyAdded.title = $title
                $alreadyAdded.subtitle = $subtitle
            }
        }
    }
    
    # 100% GARANTIA DE EVITAR EL BUG DE POWERSHELL 5.1
    if ($jsonArray.Count -eq 0) {
        $jsonString = "[]"
    } elseif ($jsonArray.Count -eq 1) {
        $jsonString = "[`n" + (ConvertTo-Json $jsonArray[0] -Depth 5) + "`n]"
    } else {
        $jsonString = ConvertTo-Json $jsonArray -Depth 5
    }
    
    $jsonString = $jsonString.Replace('\u0027', "'").Replace('\u0026', '&').Replace('\u003c', '<').Replace('\u003e', '>')
    $jsonString | Set-Content -Path ".\$folder\ringtones.json" -Encoding UTF8
    Write-Host "Se procesaron $($files.Count) canciones en '$folder'." -ForegroundColor Green
    $totalProcessed += $files.Count
}

Write-Host " "
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host "PROCESO COMPLETADO CON EXITO" -ForegroundColor Green
Write-Host "Se procesaron $totalProcessed canciones en total." -ForegroundColor Green
Write-Host "=================================================" -ForegroundColor Cyan
Write-Host " "
Write-Host "Presiona Enter para salir..."
Read-Host
