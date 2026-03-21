import csv
import urllib.request
import json
import os
import sys

# URL for HYG Database (approx 30MB) - using the one found in search
URL = "https://raw.githubusercontent.com/astronexus/HYG-Database/master/hyg/v3/hygdata_v3.csv"
OUTPUT_FILE = os.path.join(os.path.dirname(__file__), "../app/data/stars.json")

def get_category(spect):
    """
    Infer star category from spectral type.
    """
    if not spect:
        return "Yellow Dwarf" # Default
    
    spect = spect.upper()
    
    # Check for luminosity class
    is_giant = "III" in spect or "II" in spect or "I" in spect
    is_dwarf = "V" in spect or not is_giant # Assume dwarf if unspecified
    
    # Spectral class
    if spect.startswith("O") or spect.startswith("B"):
        color = "Blue"
    elif spect.startswith("A"):
        color = "Blue-White"
    elif spect.startswith("F"):
        color = "White"
    elif spect.startswith("G"):
        color = "Yellow"
    elif spect.startswith("K"):
        color = "Orange"
    elif spect.startswith("M"):
        color = "Red"
    else:
        color = "Yellow" # Default
        
    if is_giant:
        return f"{color} Giant"
    return f"{color} Dwarf"

def fetch_and_process():
    print(f"Downloading star data from {URL}...")
    try:
        with urllib.request.urlopen(URL) as response:
            lines = [l.decode('utf-8') for l in response.readlines()]
    except Exception as e:
        print(f"Error downloading: {e}")
        # Fallback to the other URL found if the first one fails
        ALT_URL = "https://raw.githubusercontent.com/EnguerranVidal/HYG-STAR-MAP/main/hygdatav3.csv"
        print(f"Trying alternative URL: {ALT_URL}")
        with urllib.request.urlopen(ALT_URL) as response:
            lines = [l.decode('utf-8') for l in response.readlines()]

    print(f"Parsing {len(lines)} lines...")
    reader = csv.DictReader(lines)
    
    stars = []
    
    # Parse all rows
    all_rows = list(reader)
    
    # Sort by brightness (mag) - lower is brighter
    # Filter out entries with missing magnitude
    valid_rows = [row for row in all_rows if row['mag']]
    valid_rows.sort(key=lambda x: float(x['mag']))
    
    # Take top 1000
    top_stars = valid_rows[:1000]
    
    print(f"Processing top {len(top_stars)} brightest stars...")
    
    seen_names = set()
    for row in top_stars:
        # Distance: parsecs to light years
        try:
            dist_pc = float(row['dist']) if row['dist'] else 0
            dist_ly = dist_pc * 3.26156
            
            # Coordinates: parsecs to light years
            # HYG uses a coordinate system where X points to vernal equinox (0h RA)
            x_pc = float(row['x']) if row['x'] else 0
            y_pc = float(row['y']) if row['y'] else 0
            z_pc = float(row['z']) if row['z'] else 0
            
            x_ly = x_pc * 3.26156
            y_ly = y_pc * 3.26156
            z_ly = z_pc * 3.26156
            
            # Names
            proper = row['proper'] if row['proper'] else None
            bf = row['bf'] if row['bf'] else None
            hip = row['hip'] if row['hip'] else None
            hd = row['hd'] if row['hd'] else None
            
            # Scientific Name Logic: proper -> bf -> hd -> hip
            # Actually, User wants "Accompanying names... accurate". 
            # Scientific name should be the catalog name (Bayer/Flamsteed preferably)
            
            scientific_name = bf if bf else (f"HD {hd}" if hd else (f"HIP {hip}" if hip else f"Unknown-{row['id']}"))
            
            # Ensure scientific name is unique and present. 
            if not scientific_name or scientific_name == "Unknown-":
                scientific_name = f"HIP {row['id']}" # Fallback

            # Deduplication
            original_name = scientific_name
            counter = 1
            while scientific_name in seen_names:
                scientific_name = f"{original_name} {counter}"
                counter += 1
            seen_names.add(scientific_name)
                
            common_name = proper
            
            # Category
            category = get_category(row['spect'])
            
            stars.append({
                "scientific_name": scientific_name,
                "common_name": common_name,
                "category": category,
                "x": x_ly,
                "y": y_ly,
                "z": z_ly,
                "distance_ly": dist_ly,
                "price": 100.00 if common_name else 12.99, # Premium for named stars
                "id": row['id']
            })
            
        except ValueError:
            continue
            
    # Ensure specific famous stars are definitely included (if not already in top 1000 for some reason)
    # The sort by mag should guarantee Sirius, Canopus, etc.
    # Sun might not be in the list as it has mag -26 and dist 0, sometimes HYG excludes it or lists it differently.
    # Let's check if Sun is there. The ID for Sun in HYG is usually 0 or missing.
    # Usually we add the Sun manually if it's missing.
    
    has_sun = any(s['common_name'] == 'Sun' or s['common_name'] == 'Sol' for s in stars)
    if not has_sun:
        print("Adding Sun manually...")
        stars.insert(0, {
            "scientific_name": "Sol",
            "common_name": "The Sun",
            "category": "Yellow Dwarf",
            "x": 0.0,
            "y": 0.0,
            "z": 0.0,
            "distance_ly": 0.0,
            "price": 1000000.00,
            "id": "0"
        })
        
    # Write to JSON
    with open(OUTPUT_FILE, 'w') as f:
        json.dump(stars, f, indent=2)
        
    print(f"Saved {len(stars)} stars to {OUTPUT_FILE}")

if __name__ == "__main__":
    fetch_and_process()
