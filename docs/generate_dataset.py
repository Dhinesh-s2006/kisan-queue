import random
import csv
from datetime import datetime, timedelta

random.seed(42)

# ---------- Reference data ----------
first_names = ["Ramesh","Suresh","Mahesh","Rajesh","Dinesh","Ganesh","Prakash","Vinod",
               "Anil","Sunil","Ravi","Kiran","Manoj","Sanjay","Ashok","Vijay","Naresh",
               "Mukesh","Yogesh","Rakesh","Lakshmi","Sunita","Kavita","Anita","Geeta",
               "Rekha","Meena","Sita","Radha","Kamala","Savitri","Parvati","Usha","Shanti"]
last_names = ["Patil","Sharma","Yadav","Reddy","Kumar","Singh","Verma","Naidu","Rao",
              "Gupta","Chauhan","Mehta","Joshi","Deshmukh","Pawar","Kale","Shinde","More"]

villages = ["Wadgaon","Karadwadi","Shirur","Rahuri","Kopargaon","Sangamner","Baramati",
            "Indapur","Daund","Purandar","Junnar","Ambegaon","Khed","Maval","Bhor","Velhe"]

crops = [("Wheat","Quintal",2275),("Paddy (Common)","Quintal",2183),
         ("Cotton","Quintal",7121),("Soybean","Quintal",4892),
         ("Maize","Quintal",2090),("Bajra","Quintal",2500),
         ("Tur (Arhar)","Quintal",7000),("Onion","Quintal",1200),
         ("Gram (Chana)","Quintal",5440),("Groundnut","Quintal",6377)]  # crop, unit, MSP-ish rate INR

centres = [
    ("PC001","Baramati APMC Procurement Centre","Baramati","Pune",60),
    ("PC002","Shirur Krishi Kendra","Shirur","Pune",45),
    ("PC003","Rahuri Procurement Hub","Rahuri","Ahmednagar",50),
    ("PC004","Sangamner Farmer Centre","Sangamner","Ahmednagar",40),
    ("PC005","Daund Mandi Procurement Point","Daund","Pune",35),
]

grading_options = ["FAQ (Fair Average Quality)","Grade A","Below FAQ - Rejected","Grade B"]
statuses_flow = ["Booked","Confirmed","Checked-In","Grading","Procured","Payment Pending","Payment Completed"]

def random_phone():
    return "9" + "".join(str(random.randint(0,9)) for _ in range(9))

def random_date(start, end):
    delta = end - start
    return start + timedelta(days=random.randint(0, delta.days), 
                              hours=random.randint(0,23), minutes=random.randint(0,59))

start_date = datetime(2026, 3, 1)
end_date = datetime(2026, 3, 10)

# ---------- 1. Procurement Centres ----------
with open("centres.csv","w",newline="") as f:
    w = csv.writer(f)
    w.writerow(["centre_id","centre_name","village_town","district","daily_capacity_slots","state"])
    for c in centres:
        w.writerow([*c,"Maharashtra"])

# ---------- 2. Farmers ----------
NUM_FARMERS = 60
farmers = []
with open("farmers.csv","w",newline="") as f:
    w = csv.writer(f)
    w.writerow(["farmer_id","name","phone","village","district","land_holding_acres",
                "primary_crop","preferred_language","smartphone_access"])
    for i in range(1, NUM_FARMERS+1):
        fid = f"F{i:04d}"
        name = f"{random.choice(first_names)} {random.choice(last_names)}"
        phone = random_phone()
        village = random.choice(villages)
        district = random.choice(["Pune","Ahmednagar"])
        land = round(random.uniform(0.5, 8.0),1)
        crop = random.choice(crops)[0]
        lang = random.choice(["Marathi","Hindi","English"])
        smartphone = random.choice(["Yes","Yes","Yes","No"])  # ~75% yes
        farmers.append(fid)
        w.writerow([fid,name,phone,village,district,land,crop,lang,smartphone])

# ---------- 3. Slots ----------
NUM_DAYS = 10
SLOTS_PER_DAY = 8  # e.g. 8 one-hour slots between 8am-4pm
with open("slots.csv","w",newline="") as f:
    w = csv.writer(f)
    w.writerow(["slot_id","centre_id","date","start_time","end_time","max_farmers","booked_count"])
    slot_counter = 1
    slot_ids = []
    for centre in centres:
        centre_id = centre[0]
        capacity_per_slot = max(3, centre[4] // SLOTS_PER_DAY)
        for day_offset in range(NUM_DAYS):
            date = (start_date + timedelta(days=day_offset)).strftime("%Y-%m-%d")
            for s in range(SLOTS_PER_DAY):
                start_hour = 8 + s
                sid = f"S{slot_counter:05d}"
                w.writerow([sid, centre_id, date, f"{start_hour:02d}:00", f"{start_hour+1:02d}:00",
                            capacity_per_slot, 0])
                slot_ids.append((sid, centre_id, date, capacity_per_slot))
                slot_counter += 1

# ---------- 4. Bookings (core transactional data) ----------
NUM_BOOKINGS = 150
with open("bookings.csv","w",newline="") as f:
    w = csv.writer(f)
    w.writerow(["booking_id","farmer_id","slot_id","centre_id","booking_date","crop",
                "quantity_quintals","status","grading_result","procured_quantity_quintals",
                "msp_rate_inr","payment_amount_inr","payment_status","queue_position_at_booking",
                "estimated_wait_minutes","sms_notifications_sent"])

    booking_counter = 1
    # track bookings per slot to respect capacity loosely
    slot_load = {}
    for _ in range(NUM_BOOKINGS):
        farmer_id = random.choice(farmers)
        sid, centre_id, date, cap = random.choice(slot_ids)
        slot_load[sid] = slot_load.get(sid, 0) + 1
        queue_pos = slot_load[sid]
        crop, unit, rate = random.choice(crops)
        qty = round(random.uniform(2, 25), 1)

        status = random.choices(statuses_flow, weights=[10,15,15,15,20,15,10])[0]
        stage_index = statuses_flow.index(status)

        grading = None
        procured_qty = None
        payment_amount = None
        payment_status = "Not Applicable"

        if stage_index >= statuses_flow.index("Grading"):
            grading = random.choices(grading_options, weights=[55,20,10,15])[0]
        if stage_index >= statuses_flow.index("Procured"):
            procured_qty = qty if grading != "Below FAQ - Rejected" else round(qty*0.0,1)
            if grading == "Below FAQ - Rejected":
                procured_qty = 0.0
            payment_amount = round(procured_qty * rate, 2) if procured_qty else 0.0
        if stage_index == statuses_flow.index("Payment Pending"):
            payment_status = "Pending"
        elif stage_index == statuses_flow.index("Payment Completed"):
            payment_status = "Completed"
        elif procured_qty is not None:
            payment_status = "Pending"

        sms_count = min(stage_index + 1, 4)  # confirmation, approaching, procured, paid

        w.writerow([
            f"B{booking_counter:05d}", farmer_id, sid, centre_id, date, crop, qty,
            status, grading or "", procured_qty if procured_qty is not None else "",
            rate, payment_amount if payment_amount is not None else "", payment_status,
            queue_pos, queue_pos * 12, sms_count
        ])
        booking_counter += 1

print("Dataset generated successfully.")
