import shutil
import os

src = r"C:\Users\LENOVO\.gemini\antigravity-ide\brain\159f54ba-4262-4366-ac69-5b0f10ee6f6e\.tempmediaStorage\media_159f54ba-4262-4366-ac69-5b0f10ee6f6e_1780991832175.png"
dst = r"C:\Users\LENOVO\.gemini\antigravity-ide\brain\159f54ba-4262-4366-ac69-5b0f10ee6f6e\collaborate_expenses_screenshot.png"

if os.path.exists(src):
    shutil.copy(src, dst)
    print("Copied successfully to", dst)
else:
    print("Source file not found:", src)
