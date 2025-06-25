import { ExcelExportService } from './src/logic/excel-export';

// Test data
const testData = [
    {
        name: 'John Doe',
        jenisPengguna: 'Rumah Tangga',
        nik: '1234567890123456',
        status: 'Success',
        errorMessage: undefined,
        timestamp: new Date()
    },
    {
        name: 'Jane Smith',
        jenisPengguna: 'Rumah Tangga',
        nik: '1234567890123457',
        status: 'Error',
        errorMessage: 'NIK not found',
        timestamp: new Date()
    }
];

async function testExcelGeneration() {
    console.log('🧪 Testing Excel generation...');
    
    const excelExporter = new ExcelExportService();
    
    try {
        // Test file generation
        console.log('📄 Testing file generation...');
        const filePath = await excelExporter.exportToExcel(testData);
        console.log(`✅ File created: ${filePath}`);
        
        // Test buffer generation
        console.log('💾 Testing buffer generation...');
        const buffer = await excelExporter.exportToExcel(testData, undefined, true);
        console.log(`✅ Buffer created, size: ${buffer.length} bytes`);
        
        // Check if file exists
        const fs = require('fs');
        if (typeof filePath === 'string' && fs.existsSync(filePath)) {
            const fileStats = fs.statSync(filePath);
            console.log(`📊 File size on disk: ${fileStats.size} bytes`);
            
            // Clean up test file
            fs.unlinkSync(filePath);
            console.log(`🗑️  Test file deleted`);
        }
        
        console.log('✅ All tests passed!');
        
    } catch (error) {
        console.error('❌ Test failed:', error);
    }
}

testExcelGeneration();
