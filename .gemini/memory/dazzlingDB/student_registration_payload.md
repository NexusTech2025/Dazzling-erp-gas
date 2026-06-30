# Student Registration Payload


```json
{
  "profile": {
    "student_name": "Bob Successful Registration",
    "email": "bob.profile@dazzling.com",
    "phone": "+918888888889",
    "gender": "Male",
    "dob": "2005-06-15",
    "mother_name": "Mary Smith",
    "father_name": "John Smith",
    "avatarUrl": "https://cdn.dazzling.com/avatars/bob.png",
    "status": "active"
  },
  "address": {
    "line1": "Jaipur Lane 2",
    "line2": "Opposite Central Park",
    "city": "Jaipur",
    "state": "Rajasthan",
    "pin_code": "302017",
    "country": "India"
  },
  "contact": {
    "email": "bob.contact@dazzling.com",
    "mobile_number": "8888888889",
    "emergency_name": "Uncle David",
    "emergency_phone": "9999999999",
    "emergency_relationship": "Uncle"
  },
  "education": [
    {
      "highest_qualification": "Class 10",
      "institution_name": "Jaipur Public School",
      "year_of_passing": 2024,
      "percentage_or_cgpa": "90%"
    }
  ],
  "enrollments": [
    {
      "enrollment_type": "package",
      "item_id": "PKG-TEST-SCI",
      "fee": 12000,
      "roll_number": 1001,
      "enrollment_date": "2026-06-01",
      "status": "active",
      "academic_status": "active",
      "package_batches": [
        { "course_id": "CRS-TEST-PHY", "batch_id": "BAT-TEST-PHY" },
        { "course_id": "CRS-TEST-CHE", "batch_id": "BAT-TEST-CHE" }
      ]
    },
    {
      "enrollment_type": "course",
      "item_id": "CRS-TEST-WD",
      "fee": 5000,
      "roll_number": 1002,
      "enrollment_date": "2026-06-01",
      "status": "active",
      "academic_status": "active",
      "batch_id": "BAT-TEST-WD"
    }
  ],
  "feeAccount": {
    "total_fee": 17000,
    "discount": 1700,
    "adjustment_type": "coupon",
    "coupon_code": "WELCOME10",
    "final_fee": 15300,
    "amount_paid": 6800,
    "balance_due": 8500,
    "is_overdue": false,
    "penalty_amount": 0,
    "next_due_date": "2026-06-15",
    "status": "active",
    "remarks": "Registered via client dashboard",
    "created_by": "admin_clerk_01",
    "fee_plan_id": "FPL-PKG-TEST-SCI-DEFAULT",
    "installments": [
      {
        "installment_number": 1,
        "due_amount": 8500,
        "paid_amount": 6800,
        "late_fee_amount": 0,
        "due_date": "2026-06-15",
        "status": "partially_paid"
      },
      {
        "installment_number": 2,
        "due_amount": 8500,
        "amount_paid": 0,
        "late_fee_amount": 0,
        "due_date": "2026-07-15",
        "status": "pending"
      }
    ]
  },
  "payment": {
    "amount_paid": 6800,
    "payment_date": "2026-06-01T20:10:00Z",
    "payment_method": "upi",
    "transaction_reference": "TXN-P1-GOOD-100",
    "status": "success",
    "remarks": "Consolidated registration payment",
    "created_by": "admin_clerk_01"
  }
}

```