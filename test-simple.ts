import { ExcelExportService } from './src/logic/excel-export';

async function testSimpleExcel() {
    const excelExporter = new ExcelExportService();
    
    // Test simple data
    const testData = [
        {
            name: 'John Doe',
            jenisPengguna: 'Rumah Tangga',
            nik: '1234567890123456',
            status: 'Success'
        },
        {
            name: 'Jane Smith',
            jenisPengguna: 'Usaha Kecil',
            nik: '6543210987654321',
            status: 'Success'
        },
        {
            name: 'Unknown',
            jenisPengguna: 'Unknown',
            nik: '9999999999999999',
            status: 'Error',
            errorMessage: 'NIK not found'
        }
    ];

    try {
        const filePath = await excelExporter.exportToExcel(testData, 'simple-report.xlsx');
        console.log(`✅ Simple Excel report created: ${filePath}`);
    } catch (error) {
        console.error('❌ Failed to create simple Excel report:', error);
    }
}

testSimpleExcel();
