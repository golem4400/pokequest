const fs = require('fs');
const path = require('path');
const axios = require('axios');
const colors = require('colors');
const readline = require('readline');
const { HttpsProxyAgent } = require('https-proxy-agent');
const { DateTime } = require('luxon');

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

    async getFarmInfo(token, proxy) {
        const url = 'https://api.pokey.quest/pokedex/farm-info';
    
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
    
    async postFarm(token, proxy) {
        const url = 'https://api.pokey.quest/pokedex/farm';
    
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
    
    async handleFarming(token, proxy) {
        const farmInfo = await this.getFarmInfo(token, proxy);
        if (farmInfo && farmInfo.error_code === 'OK') {
            const { next_farm_time } = farmInfo.data;
            const currentTime = DateTime.now().toMillis();
    
            if (currentTime > next_farm_time) {
                this.log(`Farming now...`);
                const farmResponse = await this.postFarm(token, proxy);
                if (farmResponse && farmResponse.error_code === 'OK') {
                    this.log(`Farm thành công, GOLD nhận được: ${farmResponse.data.gold_reward.toString().white}`.green);
                } else {
                    this.log(`Farm không thành công: ${farmResponse ? farmResponse.error_code : 'No response data'}`.green);
                }
            } else {
                this.log(`Thời gian farm tiếp theo: ${DateTime.fromMillis(next_farm_time).toLocaleString(DateTime.DATETIME_FULL).yellow}`.green);
            }
        } else {
            this.log(`Failed to get farm info: ${farmInfo ? farmInfo.error_code : 'No response data'}`.red);
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

    async getCardList(token, proxy) {
        const url = 'https://api.pokey.quest/pokedex/list';

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

    async upgradeCard(token, cardId, proxy) {
        const url = 'https://api.pokey.quest/pokedex/upgrade';
        const payload = { card_id: cardId };

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

    async upgradeCards(token, proxy, balance, friend) {
        const cardListResponse = await this.getCardList(token, proxy);

        if (cardListResponse && cardListResponse.error_code === 'OK') {
            const cards = cardListResponse.data.data;
            for (let card of cards) {
                if (card.amount >= card.amount_card && balance >= card.amount_gold && friend >= card.amount_friend) {
                    this.log(`Đang nâng cấp thẻ ${card.name} có rare ${card.rare}...`.yellow);
                    const upgradeResponse = await this.upgradeCard(token, card.id, proxy);

                    if (upgradeResponse && upgradeResponse.error_code === 'OK') {
                        this.log(`Nâng cấp thành công thẻ ${card.name} lên lv ${upgradeResponse.data.level}`.green);
                        balance -= card.amount_gold;
                        friend -= card.amount_friend;
                    } else {
                        this.log(`Nâng cấp không thành công thẻ ${card.name}: ${upgradeResponse ? upgradeResponse.error_code : 'No response data'}`.red);
                    }
                }
            }
        } else {
            this.log(`Không thể lấy danh sách thẻ: ${cardListResponse ? cardListResponse.error_code : 'No response data'}`.red);
        }
    }

    async getReferralList(token, proxy) {
        const url = 'https://api.pokey.quest/referral/list';
        
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
    
    async claimFriendCashback(token, referralId, proxy) {
        const url = 'https://api.pokey.quest/referral/claim-friend';
        const payload = { friend_id: referralId };
        
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
    
    async handleFriendCashback(token, proxy) {
        const referralList = await this.getReferralList(token, proxy);
    
        if (referralList && referralList.error_code === 'OK' && Array.isArray(referralList.data.data)) {
            for (let referral of referralList.data.data) {
                if (referral.friend_cashback >= 1) {
                    const claimResponse = await this.claimFriendCashback(token, referral.id, proxy);

                    if (claimResponse && claimResponse.error_code === 'OK') {
                        this.log(`Claimed $FRIEND for referral: ${referral.username.white}`.green);
                    } else {
                        this.log(`Claim $FRIEND thất bại: ${referral.username}, ${claimResponse ? claimResponse.error_code : 'No response data'}`.red);
                    }
                }
            }
        } else {
            this.log(`Không thể lấy danh sách bạn bè: ${referralList ? referralList.error_code : 'No response data'}`.red);
        }
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

                if (syncResponse && syncResponse.error_code === 'OK') {
                    let syncData = syncResponse.data;
                    this.log(`Năng lượng còn: ${syncData.available_taps.toString().white}`.green);
                    this.log(`Balance: ${Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);
                    this.log(`Balance FRIEND: ${Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'FRI').balance)}`.cyan);
                    await this.handleFarming(token, proxy);
                    const balance = Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance);
                    const friend = Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'FRI').balance);
                    await this.handleFriendCashback(token, proxy);
                    await this.upgradeCards(token, proxy, balance, friend);
                    while (syncData.available_taps > 0) {
                        if (syncData.available_taps < 50) {
                            this.log(`Năng lượng thấp (${syncData.available_taps}), chuyển tài khoản khác...`.red);
                            break;
                        }
        
                        this.log(`Bắt đầu tap...`.white);
                        const count = Math.min(Math.floor(Math.random() * (50 - 30 + 1)) + 30, syncData.available_taps);
                        const tapResponse = await this.postTapTap(token, count, proxy);
        
                        if (tapResponse && tapResponse.error_code === 'OK') {
                            syncData = tapResponse.data;
                            this.log(`Năng lượng sau khi tap: ${syncData.available_taps.toString().white}`.green);
                            this.log(`Balance sau khi tap: ${Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance)}`.cyan);
        
                            if (syncData.dropped_cards.length > 0) {
                                this.log(`Dropped Cards:`);
                                syncData.dropped_cards.forEach(card => {
                                    console.log(`    - Name: ${card.name.yellow}, Rare: ${card.rare}, Level: ${card.level}`);
                                });
                            } else {
                                this.log(`No dropped cards.`);
                            }
                        } else {
                            this.log(`Tap không thành công: ${tapResponse ? tapResponse.error_code : 'No response data'}`);
                            break;
                        }
                    }
        
                    if (hoinangcap) {
                        await this.checkAndUpgrade(token, Math.floor(syncData.balance_coins.find(coin => coin.currency_symbol === 'GOL').balance), proxy);
                    }
                } else {
                    this.log(`Lấy dữ liệu người dùng thất bại: ${syncResponse ? syncResponse.error_code : 'No response data'}`);
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