# Chess Piece Assets Source for Android App

This document provides the complete source of chess piece assets used in your web application that can be provided to your Android app developer.

## 🎯 Chess Piece Assets Location

All chess piece assets are located in your backend vendor directory:
```
chess-backend/vendor/chesslablab/php-chess/img/pieces/
```

## 📁 Available Chess Piece Sets

### 1. Standard Chess Set (Recommended)
**Location**: `/img/pieces/standard/`

#### SVG Format (Recommended for Android)
**Black Pieces**: `/img/pieces/standard/svg_black/`
- `a.svg` - Ace (Advisor)
- `b.svg` - Bishop
- `c.svg` - Cannon
- `k.svg` - King
- `n.svg` - Knight
- `p.svg` - Pawn
- `q.svg` - Queen
- `r.svg` - Rook

**White Pieces**: `/img/pieces/standard/svg_white/`
- `A.svg` - Ace (Advisor) - Uppercase for white
- `B.svg` - Bishop
- `C.svg` - Cannon
- `K.svg` - King
- `N.svg` - Knight
- `P.svg` - Pawn
- `Q.svg` - Queen
- `R.svg` - Rook

#### PNG Format (Alternative)
**72px Size**:
- `/img/pieces/standard/png/72_black/` (Black pieces, 72x72px)
- `/img/pieces/standard/png/72_white/` (White pieces, 72x72px)

**90px Size**:
- `/img/pieces/standard/png/90_black/` (Black pieces, 90x90px)
- `/img/pieces/standard/png/90_white/` (White pieces, 90x90px)

### 2. Staunty Chess Set (Alternative Design)
**Location**: `/img/pieces/staunty/`

#### SVG Format
**Black Pieces**: `/img/pieces/staunty/svg_black/`
- `b.svg` - Bishop
- `k.svg` - King
- `n.svg` - Knight
- `p.svg` - Pawn
- `q.svg` - Queen
- `r.svg` - Rook

**White Pieces**: `/img/pieces/staunty/svg_white/`
- `B.svg` - Bishop
- `K.svg` - King
- `N.svg` - Knight
- `P.svg` - Pawn
- `Q.svg` - Queen
- `R.svg` - Rook

#### PNG Format
**72px Size**:
- `/img/pieces/staunty/png/72_black/` (Black pieces, 72x72px)
- `/img/pieces/staunty/png/72_white/` (White pieces, 72x72px)

**90px Size**:
- `/img/pieces/staunty/png/90_black/` (Black pieces, 90x90px)
- `/img/pieces/staunty/png/90_white/` (White pieces, 90x90px)

## 🎨 Android Implementation Recommendations

### Format Choice
- **SVG Recommended**: For scalability and crisp rendering on all screen densities
- **PNG Alternative**: If you prefer raster images, use multiple sizes for different screen densities

### File Naming Convention for Android
The current naming convention uses:
- Lowercase for black pieces (`k`, `q`, `r`, `b`, `n`, `p`)
- Uppercase for white pieces (`K`, `Q`, `R`, `B`, `N`, `P`)
- Additional pieces: Ace/Advisor (`a`/`A`), Cannon (`c`/`C`)

### Implementation Strategy for Android
1. **Vector Drawables**: Convert SVG files to Android Vector Drawable format
2. **Multiple Densities**: Provide PNG versions for different screen densities if needed:
   - `drawable-mdpi/` (48x48px)
   - `drawable-hdpi/` (72x72px)
   - `drawable-xhdpi/` (96x96px)
   - `drawable-xxhdpi/` (144x144px)
   - `drawable-xxxhdpi/` (192x192px)

### Asset File Paths
Complete source paths for the Android developer:
```
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/a.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/b.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/c.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/k.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/n.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/p.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/q.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_black/r.svg

/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/A.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/B.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/C.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/K.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/N.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/P.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/Q.svg
/mnt/c/ArunApps/Chess-Web/chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_white/R.svg
```

## 📱 Current Web Implementation
Your web application currently uses the `react-chessboard` library with default styling, which means these chess piece assets are from the chesslablab PHP chess library but may not be actively used in your React frontend. The Android app can use these assets as a baseline to ensure visual consistency with your overall chess system architecture.

## 🔧 Extraction Commands
For the Android developer to extract these assets:

```bash
# Copy SVG pieces (recommended)
cp -r "chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/svg_*" ./android-chess-pieces/

# Copy PNG pieces (alternative)
cp -r "chess-backend/vendor/chesslablab/php-chess/img/pieces/standard/png" ./android-chess-pieces/

# Staunty design (alternative)
cp -r "chess-backend/vendor/chesslablab/php-chess/img/pieces/staunty/" ./android-chess-pieces/staunty/
```

These assets provide a complete chess piece set that can be directly used in the Android application for consistent visual design with your web application's chess ecosystem.