import asyncio
import csv
import os
import sys

# Add the parent directory to sys.path to allow imports from messfit_api
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from messfit_api.db import SessionLocal
from messfit_api.mess.models import DishORM

DISHES_CSV = os.path.join(os.path.dirname(__file__), "data", "dishes_ifct.csv")

async def main():
    print(f"Loading dishes from {DISHES_CSV}...")
    count = 0
    async with SessionLocal() as db:
        with open(DISHES_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                tags = row["tags"].split("|") if row["tags"] else []
                db.add(DishORM(
                    name=row["name"],
                    category=row["category"],
                    default_serving_unit=row["serving_unit"],
                    default_serving_grams=float(row["serving_g"]),
                    kcal=float(row["kcal"]),
                    protein_g=float(row["protein_g"]),
                    carbs_g=float(row["carbs_g"]),
                    fats_g=float(row["fats_g"]),
                    portion_icon=row["portion_icon"],
                    confidence="verified",
                    source="IFCT_2017",
                    tags=tags,
                ))
                count += 1
        await db.commit()
    print(f"Successfully seeded {count} dishes!")

if __name__ == "__main__":
    asyncio.run(main())
