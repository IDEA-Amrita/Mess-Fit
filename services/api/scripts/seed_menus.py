import asyncio
import csv
import os
import sys
from datetime import date, timedelta

# Add the parent directory to sys.path
sys.path.append(os.path.join(os.path.dirname(__file__), ".."))

from sqlalchemy import select
from messfit_api.db import SessionLocal
from messfit_api.mess.models import DishORM, MessMenuORM, MessORM

MENUS_CSV = os.path.join(os.path.dirname(__file__), "data", "mess_menus.csv")

async def main():
    print(f"Loading menus from {MENUS_CSV}...")
    
    async with SessionLocal() as db:
        # 1. Ensure the mess exists
        mess_name = "Amrita CB Boys A"
        result = await db.execute(select(MessORM).where(MessORM.name == mess_name))
        mess = result.scalar_one_or_none()
        if not mess:
            print(f"Creating mess: {mess_name}")
            mess = MessORM(name=mess_name, college="Amrita Vishwa Vidyapeetham", city="Coimbatore")
            db.add(mess)
            await db.flush()

        # 2. Load all dishes into a dictionary for quick lookup by name
        result = await db.execute(select(DishORM))
        dishes = {d.name: d.id for d in result.scalars().all()}

        # 3. Insert menus starting from today
        today = date.today()
        # Find the most recent Monday (day_of_week = 0)
        start_of_week = today - timedelta(days=today.weekday())
        
        count = 0
        with open(MENUS_CSV, encoding="utf-8") as f:
            reader = csv.DictReader(f)
            for row in reader:
                dish_name = row["dish_name"].strip()
                if dish_name not in dishes:
                    print(f"Warning: Dish '{dish_name}' not found in DB. Skipping.")
                    continue
                
                day_of_week = int(row["day_of_week"])
                effective_date = start_of_week + timedelta(days=day_of_week)

                db.add(MessMenuORM(
                    mess_id=mess.id,
                    effective_from=effective_date,
                    effective_to=effective_date + timedelta(days=6), # Valid for a week
                    day_of_week=day_of_week,
                    meal_type=row["meal_type"],
                    dish_id=dishes[dish_name],
                    availability="usually"
                ))
                count += 1
        
        await db.commit()
    print(f"Successfully seeded {count} menu items for {mess_name}!")

if __name__ == "__main__":
    asyncio.run(main())
