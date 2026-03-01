function displayStudents() {

  // -----------------------------
  // Setup Infrastructure
  // -----------------------------
  const dataSource = SheetDataSource.fromActiveSpreadsheet();
  const schemaRegistry = new SchemaRegistry(DATABASE_SCHEMA);

  const studentGateway = new TableGateway(
    "Student",
    schemaRegistry,
    dataSource
  );

  const studentRepo = new StudentRepository(studentGateway);

  const logger = new TableLogger({
    maxRows: 100,
    flatten: true,
    output: 'logger'
  });

  Logger.log("\n========== STUDENT REPOSITORY TEST ==========\n");

  // -------------------------------------------------
  // 1️⃣ ALL RECORDS
  // -------------------------------------------------
  Logger.log("\n---- all() ----");
  const allStudents = studentRepo.all();
  logger.log(allStudents);

  // -------------------------------------------------
  // 2️⃣ findById()
  // -------------------------------------------------
  Logger.log("\n---- findById('STU-104') ----");
  const studentById = studentRepo.findById("STU-104");
  logger.log(studentById ? [studentById] : []);

  // -------------------------------------------------
  // 3️⃣ Generic find()
  // -------------------------------------------------
  Logger.log("\n---- find({ class: '10' }) ----");
  const classStudents = studentRepo.find({ class: "10" });
  logger.log(classStudents);

  // -------------------------------------------------
  // 4️⃣ findByClass()
  // -------------------------------------------------
  Logger.log("\n---- findByClass('10') ----");
  logger.log(studentRepo.findByClass("10"));

  // -------------------------------------------------
  // 5️⃣ findByStream()
  // -------------------------------------------------
  Logger.log("\n---- findByStream('Science') ----");
  logger.log(studentRepo.findByStream("Science"));

  // -------------------------------------------------
  // 6️⃣ findTopRankers()
  // -------------------------------------------------
  Logger.log("\n---- findTopRankers() ----");
  logger.log(studentRepo.findTopRankers());

  // -------------------------------------------------
  // 7️⃣ findPendingFees()
  // -------------------------------------------------
  Logger.log("\n---- findPendingFees() ----");
  logger.log(studentRepo.findPendingFees());

  // -------------------------------------------------
  // 8️⃣ exists()
  // -------------------------------------------------
  Logger.log("\n---- exists({ feeStatus: 'Pending' }) ----");
  const existsPending = studentRepo.exists({ feeStatus: "Pending" });
  Logger.log("Exists: " + existsPending);

  // -------------------------------------------------
  // 9️⃣ count()
  // -------------------------------------------------
  Logger.log("\n---- count() ----");
  const totalCount = studentRepo.count();
  Logger.log("Total Students: " + totalCount);

  Logger.log("\n========== END STUDENT TEST ==========\n");
}