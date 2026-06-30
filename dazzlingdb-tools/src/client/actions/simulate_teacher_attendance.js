/**
 * @file simulate_attendance.js
 * Hardened Toolchain Client Simulation Seeder for DazzlingDB
 */

const fs = require('fs');
const path = require('path');
const { callApi } = require('../api_client'); // Resolves connection contexts

// Authoritative Active Allocated Pool from Live Snapshot
const ALLOCATED_TEACHERS = [
    { id: "TCH-EF263ECD", batchId: "BAT-C9DAD00B", start: "14:00", end: "16:00" }, // Rahul Baba
    { id: "TCH-92584198", batchId: "BAT-07A5CC72", start: "14:00", end: "16:00" }, // Abhishek Solanki
    { id: "TCH-84ECD49D", batchId: "BAT-835CB97A", start: "11:15", end: "13:15" }, // Dev Sharma
    { id: "TCH-083C6858", batchId: "BAT-0A4F4A04", start: "09:00", end: "11:00" }  // Manmohan Sir
];

// Helper: Compiles date range array skipping Sundays (Axiom 1 Rule Compliance)
function generateDateRange(startDateStr, endDateString) {
    const dates = [];
    let current = new Date(startDateStr);
    const end = new Date(endDateString);

    while (current <= end) {
        const dayOfWeek = current.getDay();
        if (dayOfWeek !== 0) { // Enforces zero-operations boundary on Sundays
            dates.push(current.toISOString().split('T')[0]);
        }
        current.setDate(current.getDate() + 1);
    }
    return dates;
}

// Helper: Generates explicit structural time objects with random offsets (5 to 30 mins)
function generateStructuredTime(baseTimeStr, signOperator = 1) {
    const [hours, minutes] = baseTimeStr.split(':').map(Number);
    // Compute random minute offset: U(5, 30)
    const offsetMinutes = Math.floor(Math.random() * (30 - 5 + 1)) + 5;

    let totalMinutes = (hours * 60) + minutes + (signOperator * offsetMinutes);

    let targetHour = Math.floor(totalMinutes / 60);
    let targetMinute = totalMinutes % 60;

    const period = targetHour >= 12 ? "PM" : "AM";

    // Transform 24H system output to 12H system formatting rules
    targetHour = targetHour % 12;
    if (targetHour === 0) targetHour = 12;

    return {
        hour: targetHour,
        minute: targetMinute,
        period: period
    };
}

async function runSimulation(startDate, endDate) {
    console.log(`\n🤖 Starting Random Attendance Simulation Flow From ${startDate} to ${endDate}...`);
    const targetDates = generateDateRange(startDate, endDate);

    for (const targetDate of targetDates) {
        console.log(`   📅 Processing Date: [${targetDate}]`);
        const recordsManifest = [];

        ALLOCATED_TEACHERS.forEach(teacher => {
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
                // Entry: early (-1) if Present, late (+1) if status evaluates to "L"
                const entryDirection = status === "L" ? 1 : -1;
                entryTime = generateStructuredTime(teacher.start, entryDirection);
                // Exit: usually leaves 5-30 mins following official shift conclusion (+1)
                exitTime = generateStructuredTime(teacher.end, 1);
            }

            recordsManifest.push({
                teacher_id: teacher.id,
                batch_id: teacher.batchId,
                status: status,
                entry_time: entryTime,
                exit_time: exitTime
            });
        });

        // Outer envelope contract matching exactly your API design requirements
        const requestEnvelope = {
            attendance_date: targetDate,
            attendance_mode: "Biometric",
            records: recordsManifest
        };

        try {
            // Dispatches the compiled payload straight to the gateway client
            await callApi('staff_mark_attendance_bulk', requestEnvelope);
            console.log(`      ✅ Bulk frame successfully uploaded and saved.`);
        } catch (error) {
            console.error(`      ❌ Error writing transaction data for ${targetDate}: ${error.message}`);
        }
    }
    console.log("\n🏁 Simulation Seeding Complete.");
}

// Parse arguments straight from command prompt execution options
const args = process.argv.slice(2);
const startParam = args[0] || "2026-06-01";
const endParam = args[1] || "2026-06-05";

runSimulation(startParam, endParam);