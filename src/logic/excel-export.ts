import ExcelJS from 'exceljs';
import path from 'path';
import fs from 'fs';

interface PelangganData {
    name: string;
    jenisPengguna: string;
    nik: string;
    status: string;
    errorMessage?: string;
    timestamp?: Date;
}

export class ExcelExportService {
    private reportsDir: string;

    constructor() {
        this.reportsDir = path.join(process.cwd(), 'reports');
        this.ensureReportsDir();
    }

    private ensureReportsDir(): void {
        if (!fs.existsSync(this.reportsDir)) {
            fs.mkdirSync(this.reportsDir, { recursive: true });
        }
    }

    async exportToExcel(data: PelangganData[], filename?: string, web?: boolean): Promise<string | any> {
        const workbook = new ExcelJS.Workbook();
        const worksheet = workbook.addWorksheet('Laporan Subsidite Pat LPG');

        // Add simple headers
        const headers = ['No', 'Nama', 'NIK', 'Jenis Pengguna', 'Status', 'Error Message'];
        worksheet.addRow(headers);

        // Add data rows
        data.forEach((pelanggan, index) => {
            worksheet.addRow([
                index + 1,
                pelanggan.name,
                pelanggan.nik,
                pelanggan.jenisPengguna,
                pelanggan.status,
                pelanggan.errorMessage || ''
            ]);
        });

        // Auto-fit columns
        worksheet.columns.forEach((column, index) => {
            if (index === 0) column.width = 5;   // No
            if (index === 1) column.width = 25;  // Nama
            if (index === 2) column.width = 20;  // NIK
            if (index === 3) column.width = 15;  // Jenis Pengguna
            if (index === 4) column.width = 12;  // Status
            if (index === 5) column.width = 40;  // Error Message
        });

        // Generate filename if not provided
        if (!filename) {
            const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
            filename = `subsidite-pat-lpg-report-${timestamp}.xlsx`;
        }

        const filePath = path.join(this.reportsDir, filename);

        if (web) {
            // For web requests, return the buffer directly
            const buffer = await workbook.xlsx.writeBuffer();
            console.log(`📊 Excel report generated for web download`);
            console.log(`📈 Total records exported: ${data.length}`);
            return buffer;
        } else {
            // Only handle file saving in Node.js environment
            await workbook.xlsx.writeFile(filePath);
            console.log(`📊 Excel report saved to: ${filePath}`);
            console.log(`📈 Total records exported: ${data.length}`);
            return filePath;
        }
    }
}
