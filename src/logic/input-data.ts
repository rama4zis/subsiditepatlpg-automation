import { ElementHandle, Page } from 'puppeteer';

interface InputData {
    nik: string;
}

export class InputDataService {
    private page: Page;

    constructor(page: Page) {
        this.page = page;
    }

    // async inputData(nik: string[]): Promise<void> {
    async inputData(nik: string): Promise<void> {
        try {
            let pelangganDone: {
                name: string;
                jenisPengguna: string;
                nik: string;
            } [] = [];

            await this.page.waitForSelector('input[id="mantine-r2"]', { timeout: 5000 });

            if (await this.page.$('input[id="mantine-r2"]') === null) {
                console.error('Input field not found. Please check the selector.');
                return;
            } else {
                console.log('Input field found, proceeding with input.');
            }

            await this.page.type('input[id="mantine-r2"]', nik, { delay: 100 });
            await this.page.click('button[type="submit"]', { delay: 100 });

            await this.page.waitForNavigation({ waitUntil: 'load' });

            // wait for selector that class contains like "infoPelangganSubsidi"
            await this.page.waitForSelector('[class*="infoPelangganSubsidi"]', { timeout: 5000 });

            // innerText infopelanggan split by "\n"
            const dataPelanggan: string[] = await this.page.$eval('[class*="infoPelangganSubsidi"]', (element: any) => {
                return element.innerText.split('\n') || [];
            });

            // console.log('Data Pelanggan:', dataPelanggan);

            // button plus 
            await this.page.waitForSelector('button[data-testid="actionIcon2"]', { timeout: 5000 });
            if (dataPelanggan.some((item: string) => item.includes('Rumah Tangga'))) {
                console.log(`Jenis Pengguna: ${dataPelanggan[dataPelanggan.length - 2]}`);
                await this.page.click('button[data-testid="actionIcon2"]', { delay: 100 });

                // then click button submit with text "Cek Pesanan"
                await this.page.click('button[data-testid="btnCheckOrder"]', { delay: 100 });

                await this.page.waitForSelector('button[data-testid="btnPay"]', { timeout: 5000 });
                if (await this.page.$('button[data-testid="btnPay"]') === null) {
                    console.error('Payment button not found. Please check the selector.');
                    return;
                } else {
                    console.log('Payment button found, proceeding with payment.');
                    // tab and enter 
                    await this.page.keyboard.press('Tab');
                    await this.page.keyboard.press('Enter');

                    // push pelangganDone
                    pelangganDone.push({
                        name: dataPelanggan[1],
                        jenisPengguna: dataPelanggan[dataPelanggan.length - 2],
                        nik: nik
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
                    // tab and enter
                    await this.page.keyboard.press('Tab');
                    await this.page.keyboard.press('Enter');

                    pelangganDone.push({
                        name: dataPelanggan[1],
                        jenisPengguna: dataPelanggan[dataPelanggan.length - 2],
                        nik: nik
                    });
                }
            }

            // back 
            // await this.page.goBack({ waitUntil: 'load' });

            // const infoPelanggan = await this.page.waitForSelector()
            // console.log(`Jenis Pengguna: ${jenisPenggunaLabel}`);

            // Input for multiple NIK into the field
            // for (const number of nik) {
            //     await this.page.type('input[id="mantine-r2"]', number, { delay: 100 });
            //     await this.page.click('button[type="submit"]', { delay: 100 });
            // }

            console.log(`Inputted NIK: ${nik}`);
        } catch (error) {
            console.error('Error inputting data:', error);
        }
    }
}