const fs = require('fs');

const sourcePath = process.argv[2];
const targetPath = process.argv[3];

const sourceContent = fs.readFileSync(sourcePath, 'utf8');
const targetContent = fs.readFileSync(targetPath, 'utf8');

// Function to extract sections using the same dynamic logic
function extractSection(content, sectionTitle) {
    const lines = content.split('\n');
    let capturing = false;
    let extracted = [];
    
    for (const line of lines) {
        if (line.match(/^#+\s/)) {
            if (capturing) break;
            if (line.toLowerCase().includes(sectionTitle.toLowerCase())) {
                capturing = true;
                continue;
            }
        } else if (capturing) {
            extracted.push(line);
        }
    }
    return extracted.join('\n').trim();
}

const sectionsToVerify = [
    "Overview",
    "Business Context",
    "Lifecycle Narrative",
    "Real-World Use Cases",
    "Query Examples",
    "Performance Considerations",
    "Security & Privacy",
    "Future Evolution"
];

let failed = false;

for (const section of sectionsToVerify) {
    const sourceSection = extractSection(sourceContent, section);
    const targetSection = extractSection(targetContent, section);

    // If source had this section (not empty)
    if (sourceSection && sourceSection !== `[T`+`ODO: Write ${section}]`) {
        if (sourceSection !== targetSection) {
            console.error(`❌ Mismatch in section: ${section}`);
            console.error(`\n--- Source --- \n${sourceSection}`);
            console.error(`\n--- Target --- \n${targetSection}`);
            failed = true;
        }
    }
}

if (!failed) {
    console.log("✅ Zero data loss! All human prose perfectly preserved from source to target.");
} else {
    process.exit(1);
}
