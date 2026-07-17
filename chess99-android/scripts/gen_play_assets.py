"""Generate Play Store + launcher icon assets from the Chess99 brand logo.

Source: Promotions/images/logo.png (640x640 — gold knight shield on navy,
"CHESS99.COM" wordmark at the bottom).

Outputs:
  chess99-android/play-store-assets/icon-512.png        (512x512 32-bit PNG)
  chess99-android/play-store-assets/feature-1024x500.png (24-bit PNG, no alpha)
  chess99-android/app/src/main/res/drawable-{dpi}/ic_launcher_foreground.png
      (adaptive-icon foreground: emblem centered in the 66% safe zone)

Run:
  conda run -n torch128 python chess99-android/scripts/gen_play_assets.py
"""

from pathlib import Path

from PIL import Image

ROOT = Path(__file__).resolve().parents[2]
LOGO = ROOT / "Promotions" / "images" / "logo.png"
OUT = ROOT / "chess99-android" / "play-store-assets"
RES = ROOT / "chess99-android" / "app" / "src" / "main" / "res"

# Emblem (shield + glow) and wordmark regions in the 640x640 source.
EMBLEM_BOX = (145, 60, 495, 450)
WORDMARK_BOX = (25, 450, 615, 560)

# Adaptive icon foreground sizes: 108dp at mdpi..xxxhdpi.
FOREGROUND_SIZES = {
    "mdpi": 108,
    "hdpi": 162,
    "xhdpi": 216,
    "xxhdpi": 324,
    "xxxhdpi": 432,
}
# Emblem occupies this fraction of the foreground canvas (66% is the safe
# zone; stay slightly inside it so nothing clips on circular masks).
EMBLEM_SCALE = 0.60


def main() -> None:
    logo = Image.open(LOGO).convert("RGBA")
    OUT.mkdir(parents=True, exist_ok=True)

    bg_color = logo.getpixel((4, 4))[:3]

    # 1) Play Store icon — full brand tile at 512.
    icon = logo.resize((512, 512), Image.LANCZOS)
    icon.save(OUT / "icon-512.png")

    # 2) Feature graphic 1024x500 — emblem over wordmark on the brand navy.
    feature = Image.new("RGB", (1024, 500), bg_color)
    emblem = logo.crop(EMBLEM_BOX)
    wordmark = logo.crop(WORDMARK_BOX)

    e_h = 330
    e_w = round(emblem.width * e_h / emblem.height)
    emblem_scaled = emblem.resize((e_w, e_h), Image.LANCZOS)
    feature.paste(emblem_scaled, ((1024 - e_w) // 2, 20), emblem_scaled)

    w_w = 520
    w_h = round(wordmark.height * w_w / wordmark.width)
    wordmark_scaled = wordmark.resize((w_w, w_h), Image.LANCZOS)
    feature.paste(wordmark_scaled, ((1024 - w_w) // 2, 370), wordmark_scaled)
    feature.save(OUT / "feature-1024x500.png")

    # 3) Adaptive launcher foregrounds — emblem on transparency, centered.
    for dpi, size in FOREGROUND_SIZES.items():
        canvas = Image.new("RGBA", (size, size), (0, 0, 0, 0))
        target = round(size * EMBLEM_SCALE)
        scale = target / max(emblem.width, emblem.height)
        fg = emblem.resize(
            (round(emblem.width * scale), round(emblem.height * scale)),
            Image.LANCZOS,
        )
        canvas.paste(fg, ((size - fg.width) // 2, (size - fg.height) // 2), fg)
        dpi_dir = RES / f"drawable-{dpi}"
        dpi_dir.mkdir(exist_ok=True)
        canvas.save(dpi_dir / "ic_launcher_foreground.png")

    print(f"bg_color={bg_color}")
    print("done")


if __name__ == "__main__":
    main()
