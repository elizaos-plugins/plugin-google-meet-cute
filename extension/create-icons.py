from PIL import Image, ImageDraw, ImageFont
import os

# Create simple icons with "EM" text (ElizaOS Meet)
sizes = [16, 48, 128]
colors = {
    'bg': (66, 133, 244),      # Google Blue
    'text': (255, 255, 255),    # White
    'connected': (76, 175, 80), # Green
    'disconnected': (244, 67, 54) # Red
}

for size in sizes:
    # Regular icon
    img = Image.new('RGB', (size, size), colors['bg'])
    draw = ImageDraw.Draw(img)
    
    # Draw text "EM"
    text = "EM"
    font_size = int(size * 0.4)
    
    # Use default font
    try:
        font = ImageFont.truetype("/System/Library/Fonts/Helvetica.ttc", font_size)
    except:
        font = ImageFont.load_default()
    
    # Get text size and center it
    bbox = draw.textbbox((0, 0), text, font=font)
    text_width = bbox[2] - bbox[0]
    text_height = bbox[3] - bbox[1]
    x = (size - text_width) // 2
    y = (size - text_height) // 2
    
    draw.text((x, y), text, fill=colors['text'], font=font)
    
    img.save(f'icon-{size}.png')
    
    # Connected state icon
    img_connected = img.copy()
    draw_connected = ImageDraw.Draw(img_connected)
    # Add green dot in corner
    dot_size = max(4, size // 8)
    draw_connected.ellipse(
        [size - dot_size - 2, size - dot_size - 2, size - 2, size - 2], 
        fill=colors['connected']
    )
    img_connected.save(f'icon-connected-{size}.png')
    
    # Disconnected state icon
    img_disconnected = img.copy()
    draw_disconnected = ImageDraw.Draw(img_disconnected)
    # Add red dot in corner
    draw_disconnected.ellipse(
        [size - dot_size - 2, size - dot_size - 2, size - 2, size - 2], 
        fill=colors['disconnected']
    )
    img_disconnected.save(f'icon-disconnected-{size}.png')

print("Icons created successfully!")
