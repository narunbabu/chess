# generate_stage_videos.ps1
# Run from Chess-Web root:
#   powershell.exe -File "chess-backend/database/videogen/generate_stage_videos.ps1"
#
# Generates 5 tutorial intro videos for the Tactical Progression Trainer stages
# using ChessVideoGen. Each video shows 2-3 sample puzzles with Stockfish analysis.
#
# Prerequisites:
#   - torch128 conda env (for ChessVideoGen)
#   - Stockfish binary in VideoProduction/studios/ChessVideoGen/stockfish/
#   - Run from Windows PowerShell (not WSL bash)

$ChessVideoGenDir = "C:\ArunApps\VideoProduction\studios\ChessVideoGen"
$OutputDir        = "C:\ArunApps\Chess-Web\chess-backend\database\videogen\output"
$ScriptsDir       = "C:\ArunApps\Chess-Web\chess-backend\database\videogen"

New-Item -ItemType Directory -Force -Path $OutputDir | Out-Null

Write-Host "=== Chess Tactical Trainer — Stage Video Generator ===" -ForegroundColor Cyan
Write-Host "Output: $OutputDir" -ForegroundColor Gray

# ─── Stage 0: Beginner ───────────────────────────────────────────────────────
Write-Host "`n[1/5] Generating Beginner stage video..." -ForegroundColor Yellow
conda run -n torch128 --cwd $ChessVideoGenDir python generate_from_authored.py `
    --json "$ScriptsDir\stage0_beginner.json" `
    --output "$OutputDir\stage0_beginner.mp4" `
    --audio-dir "$OutputDir\stage0_audio"

# ─── Stage 1: Tactical Sharpness ─────────────────────────────────────────────
Write-Host "`n[2/5] Generating Stage 1 video..." -ForegroundColor Yellow
conda run -n torch128 --cwd $ChessVideoGenDir python generate_from_authored.py `
    --json "$ScriptsDir\stage1_tactical_sharpness.json" `
    --output "$OutputDir\stage1_tactical.mp4" `
    --audio-dir "$OutputDir\stage1_audio"

# ─── Stage 2: Calculation Depth ──────────────────────────────────────────────
Write-Host "`n[3/5] Generating Stage 2 video..." -ForegroundColor Yellow
conda run -n torch128 --cwd $ChessVideoGenDir python generate_from_authored.py `
    --json "$ScriptsDir\stage2_calculation.json" `
    --output "$OutputDir\stage2_calculation.mp4" `
    --audio-dir "$OutputDir\stage2_audio"

# ─── Stage 3: Positional Tactics ─────────────────────────────────────────────
Write-Host "`n[4/5] Generating Stage 3 video..." -ForegroundColor Yellow
conda run -n torch128 --cwd $ChessVideoGenDir python generate_from_authored.py `
    --json "$ScriptsDir\stage3_positional.json" `
    --output "$OutputDir\stage3_positional.mp4" `
    --audio-dir "$OutputDir\stage3_audio"

# ─── Stage 4: Master Calculation ─────────────────────────────────────────────
Write-Host "`n[5/5] Generating Stage 4 video..." -ForegroundColor Yellow
conda run -n torch128 --cwd $ChessVideoGenDir python generate_from_authored.py `
    --json "$ScriptsDir\stage4_master.json" `
    --output "$OutputDir\stage4_master.mp4" `
    --audio-dir "$OutputDir\stage4_audio"

Write-Host "`n=== All videos generated! Upload them to YouTube and update stageVideos.js ===" -ForegroundColor Green
Write-Host "File: chess-frontend/src/components/tactical/stageVideos.js" -ForegroundColor Gray
