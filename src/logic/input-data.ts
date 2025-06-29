import { Page } from 'puppeteer';
import { ExcelExportService } from './excel-export';
import fs from 'fs';
import path from 'path';

interface InputData {
    nik: string;
}

export class InputDataService {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // Helper function to push pelanggan data to the done array
    private async pushPelangganDone(
        pelangganDone: any[], 
        nik: string, 
        status: 'Berhasil' | 'Gagal',
        name?: string | null,
        jenisPengguna?: string | null,
        error?: string
    ): Promise<void> {
        pelangganDone.push({
            name: name || null,
            status: status,
            jenisPengguna: jenisPengguna || null,
            nik: nik,
            error: error || undefined,
            timestamp: new Date()
        });
        
        if (status === 'Gagal') {
            console.error(`❌ Failed to process NIK ${nik}: ${error || 'Unknown error'}`);
            await new Promise(resolve => setTimeout(resolve, 2000)); // wait for 2 seconds before next log
        } else {
            console.log(`✅ Successfully processed NIK ${nik}`);
        }
    }

    async inputData(nik: string[], progressCallback?: (processed: number, current: string) => void, limit?: number): Promise<string | null> {
        let pelangganDone: {
            name: string | null;
            status: string | null;
            jenisPengguna: string | null;
            nik: string | null;
            error?: string;
            timestamp?: Date;
        }[] = [];
        try {
            const startTime = Date.now();
            await this.page.waitForSelector('input[id="mantine-r2"]', { timeout: 5000 });

            if (await this.page.$('input[id="mantine-r2"]') === null) {
                console.error('Input field not found. Please check the selector.');
                return null;
            } else {
                console.log('Input field found, proceeding with input.');
            }

            // Set default limit to the total number of NIKs if not specified
            const maxLimit = limit && limit > 0 ? limit : nik.length;
            let successfulProcessed = 0;
            let normalWaitingTime;
            if(nik.length > 10) {
                // If more than 10 NIKs, set a longer waiting time
                normalWaitingTime = 3000; // 3 seconds
            } else {
                normalWaitingTime = 0; // 0 seconds
            }

            // For multiple NIK
            for (let i = 0; i < nik.length && successfulProcessed < maxLimit; i++) {
                const number = nik[i];

                // Update progress
                if (progressCallback) {
                    progressCallback(i, number);
                }

                console.log(`Processing NIK ${i + 1}/${nik.length}: ${number} (Successful: ${successfulProcessed}/${maxLimit})`);

                await new Promise(resolve => setTimeout(resolve, normalWaitingTime)); // wait for normal waiting time
                await this.page.type('input[id="mantine-r2"]', number);

                const cekNik = await this.page.$('button[data-testid="btnCheckNik"]');
                if (cekNik) {
                    await this.page.$eval('button[data-testid="btnCheckNik"]', (el: any) => el.click());
                    console.log(`Clicked "Cek NIK" button for NIK ${number}.`);
                }

                await new Promise(resolve => setTimeout(resolve, 300)); // wait for popup to appear if any

                // Check if "NIK pelanggan tidak terdaftar" error appears
                try {
                    // Check if error element exists without waiting
                    const errorElement = await this.page.$('div#mantine-r2-error');
                    if (errorElement) {
                        const errorMessage = 'NIK not found or invalid';
                        console.error(`NIK ${number} not found or invalid. Please check the NIK.`);

                        // Add to pelanggan done with error
                        await this.pushPelangganDone(pelangganDone, number, 'Gagal', null, null, errorMessage);

                        // refresh page
                        await this.page.reload({ waitUntil: 'load' });
                        continue; // Skip to the next NIK
                    }

                    console.log(`No error found for NIK ${number}, proceeding...`);
                } catch (error) {
                    console.error(`Error while checking NIK ${number}:`, error);

                    // push to pelangganDone with error status
                    await this.pushPelangganDone(pelangganDone, number, 'Gagal', null, null, `Error while processing: ${error}`);

                    // refresh page
                    await this.page.reload({ waitUntil: 'load' });
                    continue; // Skip to the next NIK
                }

                // Check if multiple choices dialog appears
                try {
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
                    const perbaruiDataElement = await this.page.$('[id*="mantine-rb-body"]');

                    // if innerText includes "Perbarui Data Pelanggan"
                    if (perbaruiDataElement && await this.page.evaluate(el => (el as HTMLElement).innerText.includes('Perbarui Data Pelanggan'), perbaruiDataElement)) {
                        // If still can go to transaction
                        const lanjutkanTransaksiButton = await this.page.$('xpath///*[@id="mantine-rb-body"]/div/div[2]/button');
                        if (lanjutkanTransaksiButton && await this.page.evaluate(el => (el as HTMLElement).innerText.includes('Lanjutkan Transaksi'), lanjutkanTransaksiButton)) {
                            console.log(`Lanjutkan Transaksi button found for NIK ${number}. Clicking...`);
                            await lanjutkanTransaksiButton.click({ delay: 100 });
                            await this.page.waitForNavigation();
                            await new Promise(resolve => setTimeout(resolve, 1000)); // wait for page to load
                        } else {
                            console.error(`Lanjutkan Transaksi button not found for NIK ${number}.`);
                            // push pelangganDone with error status
                            await this.pushPelangganDone(pelangganDone, number, 'Gagal');
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

                // if get limit for too fast input
                const limitErrorElement = await this.page.$('[class*="alertContainer__kIoif"]');
                if (limitErrorElement && await this.page.evaluate((el: Element) => (el as HTMLElement).innerText.includes('Harap tunggu hingga'), limitErrorElement)) {

                    // get seconds from innerText after "hingga", format like this "0:29"
                    const limitText = await this.page.evaluate(el => (el as HTMLElement).innerText, limitErrorElement);
                    const secondsMatch = limitText.match(/hingga (\d+):(\d+)/);
                    if (secondsMatch) {
                        const minutes = parseInt(secondsMatch[1], 10);
                        const seconds = parseInt(secondsMatch[2], 10);
                        const totalSeconds = minutes * 60 + seconds;
                        console.log(`Input limit reached for NIK ${number}. Waiting for ${totalSeconds} seconds before retrying...`);
                        const screenshotPath = path.join(process.cwd(), 'screenshots', `limit-error-${number}-${Date.now()}.png`) as `${string}.png`;
                        await this.page.screenshot({ path: screenshotPath, fullPage: true });
                        console.log(`Screenshot taken for input limit error: ${screenshotPath}`);
                        await new Promise(resolve => setTimeout(resolve, totalSeconds * 1000)); // wait for the specified time
                        // take screenshot
                    }
                    
                    // reload page 
                    await this.page.reload({ waitUntil: 'load' });
                    // retry the current NIK
                    console.log(`Refreshed page for NIK ${number} due to input limit.`);
                    i--; // Decrement i to retry the same NIK
                    continue; // Skip to the next NIK
                }
                // Wait for the info pelanggan selector to appear
                await this.page.waitForSelector('[class*="infoPelangganSubsidi"]');

                // Extract data from the info pelanggan element
                const dataPelanggan: string[] = await this.page.$eval('[class*="infoPelangganSubsidi"]', (element: any) => {
                    return element.innerText.split('\n') || [];
                });
                const namaPelanggan = dataPelanggan[1] || null;
                const jenisPengguna = dataPelanggan[dataPelanggan.length - 2]

                console.log('Data Pelanggan:', dataPelanggan);

                try {
                    // const alert = await this.page.$('xpath///*[@id="__next"]/div[1]/div/main/div/div/div/div/div/div/div[2]/div[3]/div/div/span');
                    await new Promise(resolve => setTimeout(resolve, 500));
                    const alert2 = await this.page.$('[class*="mantine-Stack-root"]');

                    // if allert innerText includes "melebihi batas kewajaran"
                    if (alert2 && await this.page.evaluate(el => (el as HTMLElement).innerText.includes('melebihi batas kewajaran'), alert2)) {
                        console.error(`NIK ${number} exceeds the reasonable limit. Please check the NIK.`);
                        // push to pelangganDone with error status
                        await this.pushPelangganDone(pelangganDone, number, 'Gagal', namaPelanggan, jenisPengguna, `NIK exceeds the reasonable limit`);
                        // refresh page
                        await this.page.goto('https://subsiditepatlpg.mypertamina.id/merchant/app/verification-nik', { waitUntil: 'load' });
                        console.log(`Refreshed page to input next NIK.`);
                        continue; // Skip to the next NIK
                    } else {
                        console.log(`NIK ${number} is within the reasonable limit, proceeding...`);
                    }
                } catch (error) {
                    console.error(`Error while checking limit for NIK ${number}:`, error);
                }

                // if mantine-Stack-root mantine-1oo286g "Tidak dapat transaksi, stok tabung yang dapat dijual kosong. Silakan lakukan penebusan."
                const checkStock = await this.page.$('[class*="mantine-Stack-root"]');
                if (checkStock && await this.page.evaluate(el => (el as HTMLElement).innerText.includes('stok tabung yang dapat dijual kosong'), checkStock)) {
                    console.error(`NIK ${number} cannot proceed due to empty stock. Please check the stock.`);
                    // push to pelangganDone with error status
                    await this.pushPelangganDone(pelangganDone, number, 'Gagal', namaPelanggan, jenisPengguna, `Cannot proceed due to empty stock`);
                    // refresh page
                    await this.page.goto('https://subsiditepatlpg.mypertamina.id/merchant/app/verification-nik', { waitUntil: 'load' });
                    console.log(`Refreshed page for NIK ${number}.`);
                    // End the program, break the loop
                    break;
                }

                // Check if jenis pengguna is Rumah Tangga
                await this.page.waitForSelector('button[data-testid="actionIcon2"]', { timeout: 1000 });
                if (dataPelanggan.some((item: string) => item.includes('Rumah Tangga'))) {
                    console.log(`Jenis Pengguna: ${dataPelanggan[dataPelanggan.length - 2]}`);
                    await this.page.click('button[data-testid="actionIcon2"]', { delay: 100 });

                    // Click button submit with text "Cek Pesanan"
                    await this.page.click('button[data-testid="btnCheckOrder"]', { delay: 100 });

                    // Wait for the payment button to appear
                    await this.page.waitForSelector('button[data-testid="btnPay"]', { timeout: 1000 });
                    if (await this.page.$('button[data-testid="btnPay"]') === null) {
                        console.error('Payment button not found. Please check the selector.');
                        // reload page and continue to next NIK
                        await this.page.reload({ waitUntil: 'load' });
                        continue;
                    } else {
                        console.log('Payment button found, proceeding with payment.');
                        // Tab and enter to confirm payment
                        // wait 2 seconds
                        await new Promise(resolve => setTimeout(resolve, 2000));
                        const btnPay = await this.page.$('button[data-testid="btnPay"]');
                        if (btnPay) {
                            await this.page.$eval('button[data-testid="btnPay"]', (el: any) => el.click());
                            console.log('Clicked payment button successfully.');

                        } else {
                            console.error('Payment button not found after clicking Cek Pesanan. Please check the selector.');
                            // push to pelangganDone with error status
                            await this.pushPelangganDone(pelangganDone, number, 'Gagal', namaPelanggan, jenisPengguna, 'Payment button not found after clicking Cek Pesanan');

                            // reload page and continue to next NIK
                            await this.page.reload({ waitUntil: 'load' });
                            continue;
                        }
                       
                        // Push to pelangganDone array
                        await this.pushPelangganDone(pelangganDone, number, 'Berhasil', namaPelanggan, jenisPengguna);

                        // Increment successful counter
                        successfulProcessed++;
                        console.log(`✅ Successfully processed NIK ${number}. Count: ${successfulProcessed}/${maxLimit}`);

                        // Check if we've reached the limit
                        if (successfulProcessed >= maxLimit) {
                            console.log(`🎯 Reached the processing limit of ${maxLimit} successful NIKs. Stopping processing.`);
                            break;
                        }
                    }
                } else {
                    console.log(`Jenis Pengguna: ${dataPelanggan[dataPelanggan.length - 2]}`);
                    for (let i = 1; i <= 3; i++) { // Click the button 3 times
                        await this.page.click('button[data-testid="actionIcon2"]', { delay: 100 });
                    }
                    await this.page.waitForSelector('button[data-testid="btnCheckOrder"]', { timeout: 100 });
                    if (await this.page.$('button[data-testid="btnCheckOrder"]') === null) {
                        console.error('Check Order button not found. Please check the selector.');
                        // reload page and continue to next NIK
                        await this.page.reload({ waitUntil: 'load' });
                        continue;
                    } else {
                        console.log('Check Order button found, proceeding with check order.');
                        // Tab and enter to confirm check order
                        await this.page.keyboard.press('Tab');
                        await this.page.keyboard.press('Enter');
                        // Push to pelangganDone array
                        await this.pushPelangganDone(pelangganDone, number, 'Berhasil', namaPelanggan, jenisPengguna);

                        // Increment successful counter
                        successfulProcessed++;
                        console.log(`✅ Successfully processed NIK ${number}. Count: ${successfulProcessed}/${maxLimit}`);

                        // Check if we've reached the limit
                        if (successfulProcessed >= maxLimit) {
                            console.log(`🎯 Reached the processing limit of ${maxLimit} successful NIKs. Stopping processing.`);
                            break;
                        }
                    }
                }

                // go back to input field for the next NIK
                await this.page.goto('https://subsiditepatlpg.mypertamina.id/merchant/app/verification-nik', { waitUntil: 'load' });
            }

            console.log(`Input took ${Math.round((Date.now() - startTime) / 1000)} seconds`);

            console.log(`Inputted NIK: ${nik}`);
            console.log(`Processed ${pelangganDone.length} customers successfully`);
            console.log(`Errors encountered: ${pelangganDone.filter(p => p.status === 'Gagal').length}`);

            // Export unified report with all data
            const excelExporter = new ExcelExportService();

            // Map pelangganDone data to export format
            const allData = pelangganDone.map(customer => ({
                name: customer.name || 'Unknown',
                jenisPengguna: customer.jenisPengguna || 'Unknown',
                nik: customer.nik || 'Unknown',
                status: customer.status === 'Gagal' ? 'Error' : 'Success',
                errorMessage: customer.error || undefined,
                timestamp: customer.timestamp || new Date()
            }));

            if (allData.length > 0) {
                try {
                    const filePath = await excelExporter.exportToExcel(allData);
                    console.log(`✅ Unified Excel report successfully exported to: ${filePath}`);
                    console.log(`📊 Total records: ${allData.length}`);
                    console.log(`✅ Successful: ${allData.filter(d => d.status === 'Success').length}`);
                    console.log(`❌ Errors: ${allData.filter(d => d.status === 'Error').length}`);
                    return filePath; // Return the file path for web download
                } catch (exportError) {
                    console.error('❌ Failed to export Excel report:', exportError);
                    return null;
                }
            } else {
                console.log('No data to export to Excel.');
                return null;
            }

        } catch (error) {
            console.error('Error inputting data:', error);

            // Take screenshot and save HTML for debugging
            try {
                // Create screenshot directory if it doesn't exist
                const screenshotDir = path.join(process.cwd(), 'screenshots');
                if (!fs.existsSync(screenshotDir)) {
                    fs.mkdirSync(screenshotDir, { recursive: true });
                }

                // Generate timestamp for unique filename
                const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
                const screenshotPath = path.join(screenshotDir, `error-${timestamp}.png`) as `${string}.png`;
                const htmlPath = path.join(screenshotDir, `error-${timestamp}.html`);

                // Take screenshot
                await this.page.screenshot({
                    path: screenshotPath,
                    fullPage: true
                });

                // Get and save HTML content
                const htmlContent = await this.page.content();
                fs.writeFileSync(htmlPath, htmlContent, 'utf8');

                console.log(`📸 Error screenshot saved to: ${screenshotPath}`);
                console.log(`📄 HTML content saved to: ${htmlPath}`);
                console.log(`🌐 Current URL when error occurred: ${this.page.url()}`);
                console.log(`📄 Page title when error occurred: ${await this.page.title()}`);

            } catch (screenshotError) {
                console.error('❌ Failed to take error screenshot or save HTML:', screenshotError);
            }

            // export data Excel, till the last successful NIK
            const excelExporter = new ExcelExportService();
            const allData = pelangganDone.map(customer => ({
                name: customer.name || 'Unknown',
                jenisPengguna: customer.jenisPengguna || 'Unknown',
                nik: customer.nik || 'Unknown',
                status: customer.status === 'Gagal' ? 'Error' : 'Success',
                errorMessage: customer.error || undefined,
                timestamp: customer.timestamp || new Date()
            }));
            if (allData.length > 0) {
                try {
                    const filePath = await excelExporter.exportToExcel(allData);
                    console.log(`✅ Excel report successfully exported to: ${filePath}`);
                    return filePath;
                } catch (exportError) {
                    console.error('❌ Failed to export Excel report:', exportError);
                    return null;
                }
            }
            return null;
        }
    }
}