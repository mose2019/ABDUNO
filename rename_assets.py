import os

# Get absolute path to the assets directory
current_dir = os.path.dirname(os.path.abspath(__file__))
assets_dir = os.path.join(current_dir, "assets")

print(f"Checking folder: {assets_dir}")

if not os.path.exists(assets_dir):
    print("Error: The 'assets' folder was not found in this directory!")
else:
    files = os.listdir(assets_dir)
    print(f"Found {len(files)} files in assets.")

    for filename in files:
        old_path = os.path.join(assets_dir, filename)
        
        if os.path.isfile(old_path):
            name, ext = os.path.splitext(filename)
            
            # Clean up naming
            clean_name = name.lower().replace(" - 1", "").replace(" ", "-").replace("_", "-")
            new_filename = f"{clean_name}{ext.lower()}"
            new_path = os.path.join(assets_dir, new_filename)
            
            if old_path != new_path:
                os.rename(old_path, new_path)
                print(f"Renamed: '{filename}' -> '{new_filename}'")
            else:
                print(f"Already clean: '{filename}'")

print("Done!")
