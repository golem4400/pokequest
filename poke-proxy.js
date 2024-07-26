const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');

class PokeyQuest {
    headers(token = '') {
        const headers = {
            'Accept': 'application/json, text/plain, */*',
            'Accept-Encoding': 'gzip, deflate, br, zstd',
            'Accept-Language': 'vi-VN,vi;q=0.9,fr-FR;q=0.8,fr;q=0.7,en-US;q=0.6,en;q=0.5',
            'Content-Type': 'application/json',
            'Origin': 'https://dapp.pokequest.io',
            'Priority': 'u=1, i',
            'Referer': 'https://dapp.pokequest.io/',
            'Sec-Ch-Ua': '"Chromium";v="124", "Google Chrome";v="124", "Not-A.Brand";v="99"',
            'Sec-Ch-Ua-Mobile': '?1',
            'Sec-Ch-Ua-Platform': '"Android"',
            'Sec-Fetch-Dest': 'empty',
            'Sec-Fetch-Mode': 'cors',
            'Sec-Fetch-Site': 'cross-site',
            'User-Agent': 'Mozilla/5.0 (Linux; Android 6.0; Nexus 5 Build/MRA58N) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Mobile Safari/537.36'
        };
        if (token) {
            headers['Authorization'] = `Bearer ${token}`;
        }
        return headers;
    }

    log(msg) {
        console.log(`[*] ${msg}`);
    }

    async Countdown(seconds) {
        for (let i = seconds; i >= 0; i--) {
            readline.cursorTo(process.stdout, 0);
            process.stdout.write(`[*] Chờ ${i} giây để tiếp tục...`);
            await new Promise(resolve => setTimeout(resolve, 1000));
        }
        console.log('');
    }

    extractUserData(queryId) {
        const urlParams = new URLSearchParams(queryId);
        const user = JSON.parse(decodeURIComponent(urlParams.get('user')));
        return {
            auth_date: urlParams.get('auth_date'),
            hash: urlParams.get('hash'),
            query_id: urlParams.get('query_id'),
            user: user
        };
    }

    getProxy(i) {
        const proxyFile = path.join(__dirname, 'proxy.txt');
        const proxyList = fs.readFileSync(proxyFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        return proxyList[i];
    }

    async postToPokeyQuestAPI(data, proxy) {
        const url = 'https://api.pokey.quest/auth/login';
        const payload = {
            auth_date: data.auth_date,
            hash: data.hash,
            query_id: data.query_id,
            user: data.user
        };

        try {
            const response = await axios.post(url, payload, {
                headers: this.headers(),
                timeout: 5000,
                httpsAgent: new HttpsProxyAgent(proxy)
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`);
            return null;
        }
    }

    async postTapSync(token, proxy) {
        const url = 'https://api.pokey.quest/tap/sync';

        try {
            const response = await axios.post(url, {}, {
                headers: this.headers(token),
                timeout: 5000,
                httpsAgent: new HttpsProxyAgent(proxy)
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`);
            return null;
        }
    }

    async postTapTap(token, count, proxy) {
        const url = 'https://api.pokey.quest/tap/tap';
        const payload = {
            count: count
        };

        try {
            const response = await axios.post(url, payload, {
                headers: this.headers(token),
                timeout: 5000,
                httpsAgent: new HttpsProxyAgent(proxy)
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`);
            return null;
        }
    }

    readTokens() {
        const tokenFile = path.join(__dirname, 'token.json');
        if (fs.existsSync(tokenFile)) {
            return JSON.parse(fs.readFileSync(tokenFile, 'utf8'));
        }
        return {};
    }

    writeTokens(tokens) {
        const tokenFile = path.join(__dirname, 'token.json');
        fs.writeFileSync(tokenFile, JSON.stringify(tokens, null, 2), 'utf8');
    }

    async checkProxyIP(proxy) {
        try {
            const proxyAgent = new HttpsProxyAgent(proxy);
            const response = await axios.get('https://api.ipify.org?format=json', {
                httpsAgent: proxyAgent
            });
            if (response.status === 200) {
                return response.data.ip;
            } else {
                throw new Error(`Không thể kiểm tra IP của proxy. Status code: ${response.status}`);
            }
        } catch (error) {
            throw new Error(`Error khi kiểm tra IP của proxy: ${error.message}`);
        }
    }

    async getNextLevel(token, proxy) {
        const url = 'https://api.pokey.quest/poke/get-next-level';
    
        try {
            const response = await axios.get(url, {
                headers: this.headers(token),
                timeout: 5000,
                httpsAgent: new HttpsProxyAgent(proxy)
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`);
            return null;
        }
    }
    
    async upgradeLevel(token, proxy) {
        const url = 'https://api.pokey.quest/poke/upgrade';
    
        try {
            const response = await axios.post(url, {}, {
                headers: this.headers(token),
                timeout: 5000,
                httpsAgent: new HttpsProxyAgent(proxy)
            });
            return response.data;
        } catch (error) {
            this.log(`Error: ${error.message}`);
            return null;
        }
    }
    
    async checkAndUpgrade(token, balance, proxy) {
        let nextLevelData = await this.getNextLevel(token, proxy);
    
        while (nextLevelData && nextLevelData.error_code === 'OK' && balance > nextLevelData.data.upgrade_cost) {
            this.log(`Đã thăng cấp lên ${nextLevelData.data.name}...`.green);
            
            let upgradeResponse = await this.upgradeLevel(token, proxy);
            if (upgradeResponse && upgradeResponse.error_code === 'OK') {
                balance -= nextLevelData.data.upgrade_cost;
                nextLevelData = upgradeResponse;
            } else {
                this.log(`Nâng cấp thất bại: ${upgradeResponse ? upgradeResponse.error_code : 'No response data'}`);
                break;
            }
        }
    }    

    askQuestion(query) {
        const rl = readline.createInterface({
            input: process.stdin,
            output: process.stdout
        });

        return new Promise(resolve => rl.question(query, ans => {
            rl.close();
            resolve(ans);
        }));
    }

    async main() {
        const dataFile = path.join(__dirname, 'data.txt');
        const userData = fs.readFileSync(dataFile, 'utf8')
            .replace(/\r/g, '')
            .split('\n')
            .filter(Boolean);

        const nangcap = await this.askQuestion('Bạn có muốn nâng cấp lv không? (y/n): ');
        const hoinangcap = nangcap.toLowerCase() === 'y';
        const tokens = this.readTokens();

        while (true) {
            for (let i = 0; i < userData.length; i++) {
                const queryId = userData[i];
                const data = this.extractUserData(queryId);
                let token = tokens[i + 1];
                const proxy = this.getProxy(i);

                if (!token) {
                    const apiResponse = await this.postToPokeyQuestAPI(data, proxy);
                    if (apiResponse && apiResponse.error_code === 'OK') {
                        token = apiResponse.data.token;
                        tokens[i + 1] = token;
                        this.writeTokens(tokens);
                    } else {
                        this.log(`Login không thành công: ${apiResponse ? apiResponse.error_code : 'No response data'}`);
                        continue;
                    }
                }

                const userDetail = data.user;
                const proxyIP = await this.checkProxyIP(proxy);
                console.log(`\n========== Tài khoản ${i + 1} | ${userDetail.first_name} | IP: ${proxyIP} ==========`.blue);

                let syncResponse = await this.postTapSync(token, proxy);

                while (syncResponse && syncResponse.error_code === 'OK') {
                    const syncData = syncResponse.data;
                    this.log(`Năng lượng còn: ${syncData.available_taps.toString().white}`.green);
                    this.log(`Balance: ${Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);
                    if (hoinangcap) {
                        await this.checkAndUpgrade(token, Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance), proxy);
                        }
                    if (syncData.available_taps >= 50) {
                        this.log(`Bắt đầu tap...`.white);
                        const count = Math.floor(Math.random() * (50 - 30 + 1)) + 30;
                        const tapResponse = await this.postTapTap(token, count, proxy);

                        if (tapResponse && tapResponse.error_code === 'OK') {
                            const tapData = tapResponse.data;
                            this.log(`Năng lượng sau khi tap: ${tapData.available_taps.toString().white}`.green);
                            this.log(`Balance sau khi tap: ${Math.floor(tapData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);

                            if (tapData.dropped_cards.length > 0) {
                                this.log(`Dropped Cards:`);
                                tapData.dropped_cards.forEach(card => {
                                    console.log(`    - Name: ${card.name.yellow}, Rare: ${card.rare}, Level: ${card.level}`);
                                });
                            } else {
                                this.log(`No dropped cards.`);
                            }
                            syncResponse = tapResponse;
                        } else {
                            this.log(`Tap không thành công: ${tapResponse ? tapResponse.error_code : 'No response data'}`);
                            break;
                        }
                    } else {
                        this.log(`Năng lượng thấp, chuyển tài khoản khác !`.red);
                        break;
                    }
                }

                if (syncResponse && syncResponse.error_code !== 'OK') {
                    this.log(`Lấy dữ liệu người dùng thất bại: ${syncResponse.error_code}`);
                }
            }
            await this.Countdown(300);
        }
    }
}

if (require.main === module) {
    const pq = new PokeyQuest();
    pq.main().catch(err => {
        console.error(err.toString().red);
        process.exit(1);
    });
}