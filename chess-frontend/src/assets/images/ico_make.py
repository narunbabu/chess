from PIL import Image
import os

# Load the image
input_path = "./crown-logo-bw.png"
output_path = "./chess99.ico"

# Open and convert the image to RGBA for transparency support
img = Image.open(input_path).convert("RGBA")

# Resize to multiple icon sizes
icon_sizes = [(16, 16), (32, 32), (48, 48), (64, 64), (128, 128), (256, 256)]

# Save as .ico format with multiple sizes
img.save(output_path, format='ICO', sizes=icon_sizes)

output_path
