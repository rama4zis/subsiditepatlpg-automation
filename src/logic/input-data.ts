import { Page } from 'puppeteer';
import { ExcelExportService } from './excel-export';

interface InputData {
    nik: string;
}

export class InputDataService {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // async inputData(nik: string[]): Promise<void> {
    async inputData(nik: string[]): Promise<void> {
        let pelangganDone: {
            name: string | null;
            status: string | null;
            jenisPengguna: string | null;
            nik: string | null;
        }[] = [];

        let errorLog: {
            nik: string;
            error: string;
            timestamp: Date;
        }[] = [];
        try {
            await this.page.waitForSelector('input[id="mantine-r2"]', { timeout: 5000 });

            if (await this.page.$('input[id="mantine-r2"]') === null) {
                console.error('Input field not found. Please check the selector.');
                return;
            } else {
                console.log('Input field found, proceeding with input.');
            }

            // For multiple NIK
            for (const number of nik) {
                await this.page.type('input[id="mantine-r2"]', number, { delay: 100 });
                await this.page.click('button[type="submit"]', { delay: 100 });

                // Check if "NIK pelanggan tidak terdaftar" error appears
                try {
                    // Wait a bit for potential error to appear
                    await new Promise(resolve => setTimeout(resolve, 2000));

                    // Check if error element exists without waiting
                    const errorElement = await this.page.$('div#mantine-r2-error');
                    if (errorElement) {
                        const errorMessage = 'NIK not found or invalid';
                        console.error(`NIK ${number} not found or invalid. Please check the NIK.`);

                        // Add to error log
                        errorLog.push({
                            nik: number,
                            error: errorMessage,
                            timestamp: new Date()
                        });

                        // refresh page
                        await this.page.reload({ waitUntil: 'load' });
                        continue; // Skip to the next NIK
                    }

                    console.log(`No error found for NIK ${number}, proceeding...`);
                } catch (error) {
                    console.error(`Error while checking NIK ${number}:`, error);

                    // Add to error log
                    errorLog.push({
                        nik: number,
                        error: `Error while processing: ${error}`,
                        timestamp: new Date()
                    });

                    // refresh page
                    await this.page.reload({ waitUntil: 'load' });
                    // push to pelangganDone with error status
                    pelangganDone.push({
                        name: null,
                        status: "Gagal",
                        jenisPengguna: null,
                        nik: number
                    });
                    continue; // Skip to the next NIK
                }

                // Check if multiple choices dialog appears
                try {
                    // Wait a bit for potential dialog to appear
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const multipleChoicesElement = await this.page.$('div#mantine-r7-body');
                    if (multipleChoicesElement) {
                        console.log(`Multiple choices found for NIK ${number}. Selecting the first option.`);
                        
                        const btnTransaction = await this.page.$('button[data-testid="btnContinueTrx"]');
                        if (btnTransaction) {
                            console.log(`Button to continue transaction found for NIK ${number}. Clicking...`);
                            await btnTransaction.click({ delay: 100 });
                            console.log(`Selected first option for NIK ${number}.`);
                        } else {
                            console.error(`Button to continue transaction not found for NIK ${number}.`);
                            continue; // Skip to the next NIK
                        }
                    } else {
                        console.log(`No multiple choices for NIK ${number}, proceeding...`);
                    }
                } catch (error) {
                    console.error(`Error while handling multiple choices for NIK ${number}:`, error);
                }

                // if perbarui data pelanggan
                try {
                    await new Promise(resolve => setTimeout(resolve, 1000));

                    const perbaruiDataElement = await this.page.$('xpath///*[@id="mantine-rb-body"]/div/div[1]/button');

                    // if innerText includes "Perbarui Data Pelanggan"
                    if (perbaruiDataElement && await this.page.evaluate(el => el.innerText.includes('Perbarui Data Pelanggan'), perbaruiDataElement)) {
                        // If still can go to transaction
                        const lanjutkanTransaksiButton = await this.page.$('xpath///*[@id="mantine-rb-body"]/div/div[2]/button');
                        if (lanjutkanTransaksiButton) {
                            console.log(`Lanjutkan Transaksi button found for NIK ${number}. Clicking...`);
                            await lanjutkanTransaksiButton.click({ delay: 100 });
                        } else {
                            console.error(`Lanjutkan Transaksi button not found for NIK ${number}.`);
                            // push pelangganDone with error status
                            pelangganDone.push({
                                name: null,
                                status: "Gagal",
                                jenisPengguna: null,
                                nik: number
                            });
                            // reload 
                            await this.page.reload({ waitUntil: 'load' });
                            console.error(`Perbarui Data Pelanggan found for NIK ${number}. Please update the data manually.`);
                            continue; // Skip to the next NIK
                        }
                    } else {
                        console.log(`No Perbarui Data Pelanggan found for NIK ${number}, proceeding...`);
                    }
                } catch (error) {

                }

                await new Promise(resolve => setTimeout(resolve, 1000));

                // Wait for the info pelanggan selector to appear
                await this.page.waitForSelector('[class*="infoPelangganSubsidi"]', { timeout: 5000 });

                // Extract data from the info pelanggan element
                const dataPelanggan: string[] = await this.page.$eval('[class*="infoPelangganSubsidi"]', (element: any) => {
                    return element.innerText.split('\n') || [];
                });

                console.log('Data Pelanggan:', dataPelanggan);

                await new Promise(resolve => setTimeout(resolve, 1000));
                try {
                    const alert = await this.page.$('xpath///*[@id="__next"]/div[1]/div/main/div/div/div/div/div/div/div[2]/div[3]/div/div/span');

                    // if allert innerText includes "melebihi batas kewajaran"
                    if (alert && await this.page.evaluate(el => el.innerText.includes('melebihi batas kewajaran'), alert)) {
                        console.error(`NIK ${number} exceeds the reasonable limit. Please check the NIK.`);
                        // Add to error log
                        errorLog.push({
                            nik: number,
                            error: `NIK exceeds the reasonable limit`,
                            timestamp: new Date()
                        });
                        // push to pelangganDone with error status
                        pelangganDone.push({
                            name: null,
                            status: "Gagal",
                            jenisPengguna: null,
                            nik: number
                        });
                        // refresh page
                        await this.page.goto('https://subsiditepatlpg.mypertamina.id/merchant/app/verification-nik', { waitUntil: 'load' });
                        console.log(`Refreshed page for NIK ${number}.`);
                        continue; // Skip to the next NIK
                    } else {
                        console.log(`NIK ${number} is within the reasonable limit, proceeding...`);
                    }
                } catch (error) {
                    console.error(`Error while checking limit for NIK ${number}:`, error);
                }

                // Check if jenis pengguna is Rumah Tangga
                await this.page.waitForSelector('button[data-testid="actionIcon2"]', { timeout: 5000 });
                if (dataPelanggan.some((item: string) => item.includes('Rumah Tangga'))) {
                    console.log(`Jenis Pengguna: ${dataPelanggan[dataPelanggan.length - 2]}`);
                    await this.page.click('button[data-testid="actionIcon2"]', { delay: 100 });

                    // Click button submit with text "Cek Pesanan"
                    await this.page.click('button[data-testid="btnCheckOrder"]', { delay: 100 });

                    // Wait for the payment button to appear
                    await this.page.waitForSelector('button[data-testid="btnPay"]', { timeout: 5000 });
                    if (await this.page.$('button[data-testid="btnPay"]') === null) {
                        console.error('Payment button not found. Please check the selector.');
                        return;
                    } else {
                        console.log('Payment button found, proceeding with payment.');
                        // Tab and enter to confirm payment
                        await this.page.keyboard.press('Tab');
                        await this.page.keyboard.press('Enter');

                        // Push to pelangganDone array
                        pelangganDone.push({
                            name: dataPelanggan[1],
                            status: "Berhasil",
                            jenisPengguna: dataPelanggan[dataPelanggan.length - 2],
                            nik: number
                        });
                    }
                } else {
                    console.log(`Jenis Pengguna: ${dataPelanggan[dataPelanggan.length - 2]}`);
                    for (let i = 1; i <= 3; i++) { // Click the button 3 times
                        await this.page.click('button[data-testid="actionIcon2"]', { delay: 100 });
                    }
                    await this.page.waitForSelector('button[data-testid="btnCheckOrder"]', { timeout: 100 });
                    if (await this.page.$('button[data-testid="btnCheckOrder"]') === null) {
                        console.error('Check Order button not found. Please check the selector.');
                        return;
                    } else {
                        console.log('Check Order button found, proceeding with check order.');
                        // Tab and enter to confirm check order
                        await this.page.keyboard.press('Tab');
                        await this.page.keyboard.press('Enter');
                        // Push to pelangganDone array
                        pelangganDone.push({
                            name: dataPelanggan[1],
                            status: "Berhasil",
                            jenisPengguna: dataPelanggan[dataPelanggan.length - 2],
                            nik: number
                        });
                    }
                }

                // go back to input field for the next NIK
                await this.page.goto('https://subsiditepatlpg.mypertamina.id/merchant/app/verification-nik', { waitUntil: 'load' });
            }

            console.log(`Inputted NIK: ${nik}`);
            console.log(`Processed ${pelangganDone.length} customers successfully`);
            console.log(`Errors encountered: ${errorLog.length}`);

            // Export unified report with both success and error data
            const excelExporter = new ExcelExportService();

            // Combine successful and error data into one array
            const allData = [
                // Successful data
                ...pelangganDone.map(customer => ({
                    name: customer.name || 'Unknown',
                    jenisPengguna: customer.jenisPengguna || 'Unknown',
                    nik: customer.nik || 'Unknown',
                    status: customer.status === 'Gagal' ? 'Error' : 'Success',
                    errorMessage: customer.status === 'Gagal' ? 'Processing failed' : undefined,
                    timestamp: new Date()
                })),
                // Error data
                ...errorLog.map(error => ({
                    name: 'Unknown',
                    jenisPengguna: 'Unknown',
                    nik: error.nik,
                    status: 'Error',
                    errorMessage: error.error,
                    timestamp: error.timestamp
                }))
            ];

            if (allData.length > 0) {
                try {
                    const filePath = await excelExporter.exportToExcel(allData);
                    console.log(`✅ Unified Excel report successfully exported to: ${filePath}`);
                    console.log(`📊 Total records: ${allData.length}`);
                    console.log(`✅ Successful: ${allData.filter(d => d.status === 'Success').length}`);
                    console.log(`❌ Errors: ${allData.filter(d => d.status === 'Error').length}`);
                } catch (exportError) {
                    console.error('❌ Failed to export Excel report:', exportError);
                }
            } else {
                console.log('No data to export to Excel.');
            }

        } catch (error) {
            console.error('Error inputting data:', error);
            // export data Excel, till the last successful NIK
            const excelExporter = new ExcelExportService();
            const allData = [
                ...pelangganDone.map(customer => ({
                    name: customer.name || 'Unknown',
                    jenisPengguna: customer.jenisPengguna || 'Unknown',
                    nik: customer.nik || 'Unknown',
                    status: customer.status === 'Gagal' ? 'Error' : 'Success',
                    errorMessage: customer.status === 'Gagal' ? 'Processing failed' : undefined,
                    timestamp: new Date()
                })),
                ...errorLog.map(error => ({
                    name: 'Unknown',
                    jenisPengguna: 'Unknown',
                    nik: error.nik,
                    status: 'Error',
                    errorMessage: error.error,
                    timestamp: error.timestamp
                }))
            ];
            if (allData.length > 0) {
                try {
                    const filePath = await excelExporter.exportToExcel(allData);
                    console.log(`✅ Excel report successfully exported to: ${filePath}`);
                } catch (exportError) {
                    console.error('❌ Failed to export Excel report:', exportError);
                }
            }
        }
    }
}