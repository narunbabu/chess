# S2 — Bundle native Stockfish for all ABIs (P0, Android)

## Problem

No engine binary ships in the APK (no `jniLibs/`, nothing under `assets/` except
puzzle JSON). `StockfishBridge.init()` tries to extract `assets/stockfish` →
`filesDir/stockfish` and exec it (`StockfishBridge.kt:39-41, 132-150`); the asset
doesn't exist, so every engine feature fails on every device: **Play vs Computer
(the app's #1 CTA), Companion mode, CCT best-move, game-review analysis**
(review §3.18; callers: `PlayComputerViewModel`, `PlayMultiplayerViewModel`,
`GameHistoryViewModel` — all Hilt-inject `StockfishEngine`).

**Even if the asset existed, the current approach is dead on arrival**: since
API 29, Android blocks `exec()` of binaries in app-writable storage
(W^X enforcement; `targetSdk = 35`). The only sanctioned pattern (used by
DroidFish, lc0, etc.) is to package the executable as a fake shared library
`libstockfish.so` under `jniLibs/<abi>/` and exec it from
`context.applicationInfo.nativeLibraryDir` — that directory is exec-allowed.

## Engine choice — Stockfish 11 (deliberate, do not "upgrade")

Stockfish 16+ removed classical eval and **embeds a ~65 MB NNUE network in the
binary** — that's +65 MB per install for a kids app in the Indian market.
Stockfish 11 (classical eval, ~2 MB per ABI, ~3400+ Elo) is overwhelmingly
stronger than any user of this app and fully supports everything the code uses:
UCI, `MultiPV`, `go movetime`, `Skill Level`. The app's difficulty mapping
(levels 1–16 → movetime 100–2500 ms) does not benefit from a stronger engine.

NDK **29.0.14206865** is installed at
`C:\Users\ab\AppData\Local\Android\Sdk\ndk\29.0.14206865`.

## Tasks

### T1 — Build Stockfish 11 for 3 ABIs

```powershell
# Get sources (any temp dir outside the repo, e.g. C:\ArunApps\Chess-Web\chess99-android\third_party)
powershell.exe -Command "git clone --depth 1 --branch sf_11 https://github.com/official-stockfish/Stockfish.git 'C:\ArunApps\Chess-Web\chess99-android\third_party\stockfish-11'"
```

Compile directly with the NDK clang wrappers (no Makefile — deterministic on
Windows). From the `src/` directory, for each ABI (`$TC` =
`C:\Users\ab\AppData\Local\Android\Sdk\ndk\29.0.14206865\toolchains\llvm\prebuilt\windows-x86_64\bin`):

| ABI | Compiler wrapper | Extra defines |
|-----|------------------|---------------|
| arm64-v8a | `aarch64-linux-android26-clang++.cmd` | `-DIS_64BIT -DUSE_POPCNT` |
| armeabi-v7a | `armv7a-linux-androideabi26-clang++.cmd` | *(none)* |
| x86_64 | `x86_64-linux-android26-clang++.cmd` | `-DIS_64BIT -DUSE_POPCNT -msse3 -mpopcnt` |

Command shape (adjust per row; note `syzygy/tbprobe.cpp` must be included):

```powershell
& "$TC\aarch64-linux-android26-clang++.cmd" -O3 -std=c++17 -DNDEBUG -DUSE_PTHREADS `
  -fPIE -pie -static-libstdc++ -Wno-deprecated-declarations `
  (Get-ChildItem *.cpp).Name syzygy/tbprobe.cpp -o libstockfish.so
```

Verify each output with `llvm-readelf.exe -h libstockfish.so` (same bin dir):
must be `DYN`/`EXEC` for the right machine (AArch64 / ARM / X86-64).

**Fallback if SF11 won't compile with clang 20** (only after a genuine attempt —
capture the error in your report): download the official Stockfish 17.1 release
assets `stockfish-android-armv8.tar` + `stockfish-android-armv7.tar` from
`github.com/official-stockfish/Stockfish/releases`, rename the binaries to
`libstockfish.so`. Accept: no x86_64 (emulator verification then requires an
ARM64 system image or on-hardware test) and ~+75 MB per install — flag this
size cost loudly in your completion report so the owner can veto.

x86_64 exists ONLY so the emulator can run the engine in QA; it ships in the
AAB but Play delivers per-ABI, so real devices only download their own.

### T2 — Package into the app

1. Place binaries at:
   `app/src/main/jniLibs/arm64-v8a/libstockfish.so`
   `app/src/main/jniLibs/armeabi-v7a/libstockfish.so`
   `app/src/main/jniLibs/x86_64/libstockfish.so`
2. `app/build.gradle.kts` — in `android { defaultConfig { … } }` add:
   ```kotlin
   ndk { abiFilters += listOf("arm64-v8a", "armeabi-v7a", "x86_64") }
   ```
   and in `android { … }`:
   ```kotlin
   packaging { jniLibs { useLegacyPackaging = true } }
   ```
   (`useLegacyPackaging = true` guarantees extraction to `nativeLibraryDir`
   so the file is a real exec-able path, not a page-aligned APK mapping.)
3. Do NOT commit `third_party/` sources; add it to `.gitignore` if created
   inside the repo. The three `libstockfish.so` files DO belong in the tree.

### T3 — Point StockfishBridge at nativeLibraryDir

In `StockfishBridge.kt`:
- Replace the assets-extraction path (`extractBinary`, lines ~132–150 — delete
  it) with:
  ```kotlin
  val stockfishPath = File(context.applicationInfo.nativeLibraryDir, "libstockfish.so").absolutePath
  ```
- No chmod needed (the loader extracts it executable).
- If the file is missing (shouldn't happen once packaged): throw with an
  internal message; the **user-facing** copy is handled in T4.
- Keep the ProcessBuilder/stdin/stdout mechanics unchanged.

### T4 — Honest failure UI (belt-and-braces)

`PlayComputerScreen` currently shows the raw doubled message
*"Failed to start engine: Failed to start Stockfish engine"*. Wherever engine
init errors surface to UI (PlayComputer, Companion selector, game-review
analysis), replace with one friendly line + a redirect action:
> "The chess engine couldn't start on this device." — button: **"Try a puzzle instead"** → navigates to Tactical Trainer.

Never show `e.message`.

## Acceptance criteria (RELEASE build on emulator-5554, prod backend)

1. Play vs Computer, level 2, play as White: game starts, engine replies to
   `1.e4` within 3 s (min perceived think time is 1500 ms — that's expected).
   Play ≥6 plies; moves are legal and sensible. Screenshot mid-game.
2. Level 16: engine replies within ~4 s (2500 ms movetime + overhead).
3. Game review (Game History → a finished game → analysis) produces evals —
   requires S3's Game History fix to reach it; if S3 isn't merged yet, verify
   via Companion mode instead: select a companion in a casual game, it
   produces a move.
4. APK size delta vs current release build < 8 MB (report the numbers).
5. `unzip -l app-release.apk | grep libstockfish` shows all three ABIs (or two
   + loud size flag, if the SF17 fallback was used).
6. `gradlew.bat compileReleaseKotlin lintRelease assembleRelease` green;
   screenshots as `review-artifacts/fix-S2-*.png`.
