import json

def export_data():
    print("Exporting data from API to CSV...")
    # Mock data export
    with open("dataset.csv", "w") as f:
        f.write("orderCode,item,size,price\n")
        f.write("LUB-001,Tee,M,20\n")
        
if __name__ == "__main__":
    export_data()
