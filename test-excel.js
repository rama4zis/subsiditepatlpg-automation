const { ExcelExportService } = require('./dist/logic/excel-export');

async function testExcelExport() {
    const excelExporter = new ExcelExportService();
    
    // Test data
    const testData = [
        {
            name: 'John Doe',
            jenisPengguna: 'Rumah Tangga',
            nik: '1234567890123456',
            status: 'Processed',
            timestamp: new Date()
        },
        {
            name: 'Jane Smith',
            jenisPengguna: 'Usaha Kecil',
            nik: '6543210987654321',
            status: 'Processed',
            timestamp: new Date()
        }
    ];

    try {
        const filePath = await excelExporter.exportToExcel(testData, 'test-report.xlsx');
        console.log(`✅ Test Excel file created successfully: ${filePath}`);
    } catch (error) {
        console.error('❌ Failed to create test Excel file:', error);
    }
}

testExcelExport();
