import os
import glob
import tkinter as tk
from tkinter import messagebox
from PIL import Image, ImageTk

INPUT_DIR = "contour"
OUTPUT_DIR = "assets/images/cosmetics/borders"
TARGET_SIZE = 1000
AVATAR_SIZE = 500
AVATAR_OFFSET = (TARGET_SIZE - AVATAR_SIZE) // 2

class BorderEditor(tk.Tk):
    def __init__(self, images):
        super().__init__()
        self.title("Ajustement des Bordures d'Avatar")
        self.geometry("900x700")
        
        self.images = images
        self.current_idx = 0
        
        self.canvas = tk.Canvas(self, width=800, height=600, bg="#2C3E50")
        self.canvas.pack(pady=10)
        
        btn_frame = tk.Frame(self)
        btn_frame.pack(pady=10)
        
        tk.Button(btn_frame, text="< Précédent", font=("Arial", 12), command=self.prev_image).pack(side=tk.LEFT, padx=10)
        tk.Button(btn_frame, text="Sauvegarder & Suivant >", font=("Arial", 12, "bold"), bg="#27AE60", fg="white", command=self.save_and_next).pack(side=tk.LEFT, padx=10)
        
        tk.Label(self, text="Utilise la souris pour DEPLACER le carré rouge.\nClique près de l'angle en bas à droite pour REDIMENSIONNER.\nLa molette de la souris redimensionne aussi le carré.", font=("Arial", 10)).pack()
        
        self.rect_id = None
        self.rect_size = 300
        self.rect_x = 250
        self.rect_y = 150
        
        self.start_x = 0
        self.start_y = 0
        self.drag_mode = None
        
        self.canvas.bind("<ButtonPress-1>", self.on_press)
        self.canvas.bind("<B1-Motion>", self.on_drag)
        self.canvas.bind("<MouseWheel>", self.on_scroll)
        
        if not os.path.exists(OUTPUT_DIR):
            os.makedirs(OUTPUT_DIR)
            
        self.load_image()

    def load_image(self):
        if self.current_idx >= len(self.images):
            messagebox.showinfo("Terminé", "Toutes les images ont été traitées !\nLes bordures finales sont dans 'assets/images/cosmetics/borders'")
            self.destroy()
            return
            
        self.img_path = self.images[self.current_idx]
        self.title(f"Ajustement ({self.current_idx+1}/{len(self.images)}) : {os.path.basename(self.img_path)}")
        
        self.original_img = Image.open(self.img_path).convert("RGBA")
        
        # Fit image to canvas for display
        self.display_scale = min(800 / self.original_img.width, 600 / self.original_img.height)
        new_w = int(self.original_img.width * self.display_scale)
        new_h = int(self.original_img.height * self.display_scale)
        
        # Use Image.LANCZOS or Image.Resampling.LANCZOS depending on PIL version
        resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
        self.tk_img = ImageTk.PhotoImage(self.original_img.resize((new_w, new_h), resample_filter))
        
        self.canvas.delete("all")
        self.img_cx = 400 - new_w / 2
        self.img_cy = 300 - new_h / 2
        self.canvas.create_image(400, 300, image=self.tk_img)
        
        self.draw_rect()

    def draw_rect(self):
        if self.rect_id:
            self.canvas.delete(self.rect_id)
        
        # Dessiner la zone que l'avatar occupera (trou)
        self.rect_id = self.canvas.create_rectangle(
            self.rect_x, self.rect_y, 
            self.rect_x + self.rect_size, self.rect_y + self.rect_size, 
            outline="#E74C3C", width=3, dash=(5, 5)
        )
        # Handle visuelle pour le redimensionnement (en bas à droite)
        self.canvas.create_rectangle(
            self.rect_x + self.rect_size - 10, self.rect_y + self.rect_size - 10,
            self.rect_x + self.rect_size, self.rect_y + self.rect_size,
            fill="#E74C3C", outline="white"
        )

    def on_press(self, event):
        self.start_x = event.x
        self.start_y = event.y
        if abs(event.x - (self.rect_x + self.rect_size)) < 20 and abs(event.y - (self.rect_y + self.rect_size)) < 20:
            self.drag_mode = 'resize'
        else:
            self.drag_mode = 'move'

    def on_drag(self, event):
        dx = event.x - self.start_x
        dy = event.y - self.start_y
        
        if self.drag_mode == 'move':
            self.rect_x += dx
            self.rect_y += dy
        elif self.drag_mode == 'resize':
            diff = max(dx, dy)
            self.rect_size += diff
            if self.rect_size < 50: self.rect_size = 50
            
        self.start_x = event.x
        self.start_y = event.y
        self.draw_rect()
        
    def on_scroll(self, event):
        if event.delta > 0:
            self.rect_size += 10
            self.rect_x -= 5
            self.rect_y -= 5
        else:
            self.rect_size -= 10
            self.rect_x += 5
            self.rect_y += 5
        self.draw_rect()

    def save_and_next(self):
        real_x = (self.rect_x - self.img_cx) / self.display_scale
        real_y = (self.rect_y - self.img_cy) / self.display_scale
        real_size = self.rect_size / self.display_scale
        
        scale = AVATAR_SIZE / real_size
        new_w = int(self.original_img.width * scale)
        new_h = int(self.original_img.height * scale)
        
        resample_filter = getattr(Image, 'Resampling', Image).LANCZOS
        resized_img = self.original_img.resize((new_w, new_h), resample_filter)
        
        scaled_x = int(real_x * scale)
        scaled_y = int(real_y * scale)
        
        final_img = Image.new("RGBA", (TARGET_SIZE, TARGET_SIZE), (0,0,0,0))
        paste_x = AVATAR_OFFSET - scaled_x
        paste_y = AVATAR_OFFSET - scaled_y
        
        final_img.paste(resized_img, (paste_x, paste_y))
        
        out_name = os.path.basename(self.img_path)
        final_img.save(os.path.join(OUTPUT_DIR, out_name))
        
        print(f"Sauvegardé : {out_name}")
        self.current_idx += 1
        self.load_image()

    def prev_image(self):
        if self.current_idx > 0:
            self.current_idx -= 1
            self.load_image()

if __name__ == "__main__":
    images = glob.glob(os.path.join(INPUT_DIR, "*.png"))
    if not images:
        print(f"Aucune image .png trouvée dans le dossier '{INPUT_DIR}'")
    else:
        app = BorderEditor(images)
        app.mainloop()
