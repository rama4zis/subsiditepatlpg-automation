import { ExcelExportService } from './src/logic/excel-export';

async function testExcelExport() {
    const excelExporter = new ExcelExportService();
    
    // Test unified data with both success and error records
    const testData = [
        {
            name: 'John Doe',
            jenisPengguna: 'Rumah Tangga',
            nik: '1234567890123456',
            status: 'Success',
            timestamp: new Date()
        },
        {
            name: 'Jane Smith',
            jenisPengguna: 'Usaha Kecil',
            nik: '6543210987654321',
            status: 'Success',
            timestamp: new Date()
        },
        {
            name: 'Unknown',
            jenisPengguna: 'Unknown',
            nik: '9999999999999999',
            status: 'Error',
            errorMessage: 'NIK not found or invalid',
            timestamp: new Date()
        },
        {
            name: 'Unknown',
            jenisPengguna: 'Unknown',
            nik: '8888888888888888',
            status: 'Error',
            errorMessage: 'Connection timeout',
            timestamp: new Date()
        }
    ];

    try {
        const filePath = await excelExporter.exportToExcel(testData, 'unified-test-report.xlsx');
        console.log(`✅ Unified Excel report created successfully: ${filePath}`);
        console.log(`📊 Total records: ${testData.length}`);
        console.log(`✅ Successful: ${testData.filter(d => d.status === 'Success').length}`);
        console.log(`❌ Errors: ${testData.filter(d => d.status === 'Error').length}`);
    } catch (error) {
        console.error('❌ Failed to create unified Excel report:', error);
    }
}

testExcelExport();
