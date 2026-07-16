/**
 * @file simulate_student_attendance.js
 * Toolchain Client Simulation Seeder for DazzlingDB Student Attendance
 * prepared for Class 11 Physics CBSE (A) - batch_id: BAT-0A4F4A04
 */

const fs = require('fs');
const path = require('path');
const { callApi } = require('../api_client');

// Batch ID and student IDs
const BATCH_ID = "BAT-0A4F4A04";
const STUDENTS = [
    "STU-F120AE5D",
    "STU-CFF573D5",
    "STU-D5AAEF7D",
    "STU-0667DFFF",
    "STU-AFDC2802"
];

// Helper: Compiles date range array skipping Sundays
function generateDateRange(startDateStr, endDateString) {
    const dates = [];
    let current = new Date(startDateStr);
    const end = new Date(endDateString);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0) { // Skip Sundays
            dates.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// Helper: Generates explicit structural time objects with random offsets (5 to 30 mins)
function generateStructuredTime(baseTimeStr, signOperator = 1) {
    const [hours, minutes] = baseTimeStr.split(':').map(Number);
    const offsetMinutes = Math.floor(Math.random() * (30 - 5 + 1)) + 5;

    let totalMinutes = (hours * 60) + minutes + (signOperator * offsetMinutes);

    let targetHour = Math.floor(totalMinutes / 60);
    let targetMinute = totalMinutes % 60;

    const period = targetHour >= 12 ? "PM" : "AM";

    targetHour = targetHour % 12;
    if (targetHour === 0) targetHour = 12;

    return {
        hour: targetHour,
        minute: targetMinute,
        period: period
    };
}

async function runSimulation(startDate, endDate) {
    console.log(`\n🤖 Starting Student Attendance Simulation From ${startDate} to ${endDate}...`);
    const targetDates = generateDateRange(startDate, endDate);

    for (const targetDate of targetDates) {
        console.log(`   📅 Processing Date: [${targetDate}]`);
        const recordsManifest = [];

        STUDENTS.forEach(studentId => {
            const rand = Math.random();
            let status = "P"; // Present
            let entryTime = null;
            let exitTime = null;

            // Probability assignment: 85% Present, 10% Late ("L"), 5% Absent ("A")
            if (rand > 0.85 && rand <= 0.95) {
                status = "L";
            } else if (rand > 0.95) {
                status = "A";
            }

            if (status !== "A") {
                // Class starts at 09:00, ends at 11:00
                const entryDirection = status === "L" ? 1 : -1;
                entryTime = generateStructuredTime("09:00", entryDirection);
                exitTime = generateStructuredTime("11:00", 1);
            }

            recordsManifest.push({
                student_id: studentId,
                status: status,
                entry_time: entryTime,
                exit_time: exitTime
            });
        });

        const requestEnvelope = {
            batch_id: BATCH_ID,
            attendance_date: targetDate,
            attendance_mode: "Biometric",
            marked_by: "TCH-083C6858", // Manmohan Sir
            records: recordsManifest
        };

        try {
            await callApi('student_mark_attendance_bulk', requestEnvelope);
            console.log(`      ✅ Bulk student attendance successfully uploaded.`);
        } catch (error) {
            console.error(`      ❌ Error writing student attendance for ${targetDate}: ${error.message}`);
        }
    }
    console.log("\n🏁 Student Seeding Complete.");
}

// Parse args or default to current month (July 2026)
const args = process.argv.slice(2);
const startParam = args[0] || "2026-07-01";
const endParam = args[1] || "2026-07-08";

runSimulation(startParam, endParam);
