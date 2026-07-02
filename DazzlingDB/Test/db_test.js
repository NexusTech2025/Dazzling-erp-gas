function run_db() {

}





function get_all() {

    const db = DBContext.getInstance();
    const result = db.TeacherSalaryConfig.all();

    // Define the columns you want to hide from the table
    const columnsToExclude = [
        "remark",
        "notes",
        "__tx_id",
        "__tx_status",
        "__created_at",
        "salary_config_id",
        "settlement_state"
    ];

    // Map the results, deleting any properties in the exclusion list
    const filteredData = result.map(item => {
        const json = item.toJSON();

        columnsToExclude.forEach(col => {
            delete json[col];
        });

        return json;
    });

    const { printTable } = ApiTestHelper;
    printTable("Filtered Teacher Salary Configs", filteredData);

    // const result_str = JSON.stringify(filteredData);
    // console.log(`Result: ${result_str}`);

}


function get_with_filter() {

    const db = DBContext.getInstance();
    const result = db.TeacherSalaryConfig.where({ entity_id: "TCH-EF263ECD", rate_type: "monthly" });

    // Define the columns you want to hide from the table
    const columnsToExclude = [
        "remark",
        "notes",
        "__tx_id",
        "__tx_status",
        "__created_at",
        "salary_config_id",
        "settlement_state"
    ];

    // Map the results, deleting any properties in the exclusion list
    const filteredData = result.map(item => {
        const json = item.toJSON();

        columnsToExclude.forEach(col => {
            delete json[col];
        });

        return json;
    });


    const { printTable } = ApiTestHelper;
    printTable("Filtered Teacher Salary Configs", filteredData);
}