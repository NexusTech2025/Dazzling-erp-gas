/**
 * @file calculate_student_attendance.js
 * Script to query student data with attendance relations and calculate total presents per student.
 */

const { callApi } = require('../api_client');

async function main() {
  console.log('🔍 Querying Student attendance records via data_query API...');

  try {
    const response = await callApi('data_query', {
      target: 'Student',
      where: {},
      include: {
        studentattendance: {}
      }
    });

    const students = response.data || [];
    console.log(`\n✅ Retrieved ${students.length} student records.\n`);

    const attendanceSummary = students.map(student => {
      const records = student.studentattendance || [];
      
      let presentCount = 0;
      let absentCount = 0;
      let lateCount = 0;

      records.forEach(rec => {
        const st = (rec.status || '').toUpperCase();
        if (st === 'P') presentCount++;
        else if (st === 'A') absentCount++;
        else if (st === 'L') lateCount++;
      });

      const totalRecorded = records.length;
      // Effective Attendance includes Present and Late entries
      const effectivePresent = presentCount + lateCount;
      const attendancePercentage = totalRecorded > 0 
        ? ((effectivePresent / totalRecorded) * 100).toFixed(1) + '%' 
        : 'N/A';

      return {
        'Student ID': student.studentid || student.student_id,
        'Student Name': student.student_name,
        'Total Present (P)': presentCount,
        'Total Late (L)': lateCount,
        'Total Absent (A)': absentCount,
        'Total Sessions': totalRecorded,
        'Attendance Rate': attendancePercentage
      };
    });

    console.log('================================================================================');
    console.log('📊 STUDENT ATTENDANCE SUMMARY & PRESENT COUNTS');
    console.log('================================================================================');
    console.table(attendanceSummary);

  } catch (error) {
    console.error(`\n❌ Failed to calculate student attendance: ${error.message}\n`);
    process.exit(1);
  }
}

main();
