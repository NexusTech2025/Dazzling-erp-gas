/**
 * Diagnostic Script: JS Date Instantiation & Formatting Analysis
 * Focus: 12-Hour AM/PM vs 24-Hour Time Variants
 * Location: DazzlingDB/NodeTest/time_format_expanded_diagnostic.js
 */

const sampleFormats = [
    // ================= 12-HOUR AM/PM FORMATS =================
    {
        label: "12-Hour format (Standard Morning)",
        input: "2026-03-16 08:30:00 AM"
    },
    {
        label: "12-Hour format (Standard Evening)",
        input: "2026-03-16 08:30:00 PM"
    },
    {
        label: "12-Hour format (Noon Edge Case - 12 PM)",
        input: "2026-03-16 12:45:00 PM"
    },
    {
        label: "12-Hour format (Midnight Edge Case - 12 AM)",
        input: "2026-03-16 12:15:00 AM"
    },
    {
        label: "12-Hour format (Lowercase am/pm with padding variances)",
        input: "2026/03/16 4:20 pm"
    },
    {
        label: "Standalone Time-Only 12-Hour String (High Parsing Risk)",
        input: "08:30 PM"
    },

    // ================= 24-HOUR FORMATS =================
    {
        label: "24-Hour format (Standard Morning)",
        input: "2026-03-16 08:30:00"
    },
    {
        label: "24-Hour format (Afternoon/Military Time)",
        input: "2026-03-16 20:30:00"
    },
    {
        label: "24-Hour format (Noon Hour equivalent)",
        input: "2026-03-16 12:45:00"
    },
    {
        label: "24-Hour format (Midnight Hour equivalent)",
        input: "2026-03-16 00:15:00"
    },
    {
        label: "Standalone Time-Only 24-Hour String (High Parsing Risk)",
        input: "20:30"
    }
];

console.log("==========================================================================");
console.log("         EXPANDED TIME FORMAT INTERPRETATION PARSER REPORT                ");
console.log("==========================================================================\n");

const localeOptions = { year: 'numeric', month: '2-digit', day: '2-digit' };
const timeOptions = { hour: '2-digit', minute: '2-digit', second: '2-digit', hour12: false };

sampleFormats.forEach(({ label, input }, index) => {
    let dt = null;
    let parseError = false;

    try {
        dt = new Date(input);
    } catch (err) {
        parseError = true;
    }

    console.log(`Format #${index + 1}: [${label}]`);
    console.log(`  Input Payload:          ${JSON.stringify(input)}`);

    if (parseError || !dt || isNaN(dt.getTime())) {
        console.log(`  ❌ Native Evaluation:   Invalid Date (Runtime Parsing Failure)`);
    } else {
        console.log(`  ✅ toLocaleDateString(): ${dt.toLocaleDateString('en-CA', localeOptions)}`);
        console.log(`  ✅ toLocaleTimeString(): ${dt.toLocaleTimeString([], timeOptions)} (Forced 24h Output)`);
        console.log(`  🌐 ISO String (UTC):     ${dt.toISOString()}`);
        console.log(`  🕒 Local Wall Clock hr:  ${dt.getHours()} (using .getHours())`);
    }
    console.log("--------------------------------------------------------------------------");
});